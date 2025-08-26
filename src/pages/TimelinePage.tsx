import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import emailjs from '@emailjs/browser';
import SlabText from '../components/SlabText';
import HeartButton from '../components/HeartButton';
import { Link, useLocation } from 'react-router-dom';
import RippleAnimation from '../components/RippleAnimation';
import WaveRipple from '../components/WaveRippleAnimation';

interface Post {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;

  // Ripple fields
  rippleId?: string;
  parentPostId?: string | null;
  generation?: number;

  // Recipients
  recipients?: string[];
  recipient?: string | null;

  // NEW for notifications
  authorEmail?: string | null;
}

interface Comment {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TimelinePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<{ [postId: string]: number }>({});
  const [userLikes, setUserLikes] = useState<{ [postId: string]: boolean }>({});
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [posting, setPosting] = useState(false);

  // Read ripple context from URL (for “continue ripple” via timeline form)
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const fromRippleId = params.get('rippleId');
  const parent = params.get('parent');
  const nextGen = Number(params.get('gen') || '1');

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];

      setPosts(fetchedPosts);
      setLoading(false);

      fetchedPosts.forEach((post) => {
        // Likes stream
        const likesRef = collection(db, 'posts', post.id, 'likes');
        onSnapshot(likesRef, (likeSnapshot) => {
          setLikes((prev) => ({ ...prev, [post.id]: likeSnapshot.size }));
          const uid = auth.currentUser?.uid;
          if (uid) {
            const likedByUser = likeSnapshot.docs.some(doc => doc.id === uid);
            setUserLikes((prev) => ({ ...prev, [post.id]: likedByUser }));
          }
        });

        // Comments stream
        const commentsRef = collection(db, 'posts', post.id, 'comments');
        const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
        onSnapshot(commentsQuery, (commentSnapshot) => {
          const fetchedComments = commentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Comment[];
          setComments((prev) => ({ ...prev, [post.id]: fetchedComments }));
        });
      });
    });

    return () => unsubscribe();
  }, []);

  const toggleLike = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const likeRef = doc(db, 'posts', postId, 'likes', uid);
    const likeDoc = await getDoc(likeRef);

    if (likeDoc.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, { likedAt: Date.now() });
    }
  };

  // COMMENT: now sends email to the post author
  const handleCommentSubmit = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    const commentText = newComment[postId]?.trim();
    if (!uid || !commentText) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text: commentText,
      timestamp: serverTimestamp(),
    });

    setNewComment((prev) => ({ ...prev, [postId]: '' }));

    // Send "Comment on good deed" email to the post owner (template_rvhdgz4)
    try {
      const postSnap = await getDoc(doc(db, 'posts', postId));
      if (postSnap.exists()) {
        const post = postSnap.data() as Post;
        const to_email = post.authorEmail || null;
        const from_name = user?.displayName || 'Anonymous';
        if (to_email && to_email !== user?.email) {
          const post_link = `${window.location.origin}/post/${postId}`;
          await emailjs.send(
            'service_28zemt7',
            'template_rvhdgz4',
            {
              to_email,
              to_name: post.displayName || '',
              from_name,
              comment_text: commentText,
              post_link,
              app_name: 'Ripple',
            },
            'q1XMFHhBE9upOF5cB'
          );
        }
      }
    } catch (err) {
      console.error('Failed to send comment notification:', err);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const postText = text.trim();
    const rawEmail = email.trim();
    if (!postText || !rawEmail) return;

    const user = auth.currentUser;
    if (!user) return;

    const recipients = rawEmail
      .split(/[,\s;]+/)
      .map(e => e.trim())
      .filter(Boolean);

    const bad = recipients.find(r => !emailRegex.test(r));
    if (bad) {
      alert(`That email looks off: "${bad}". Please fix and try again.`);
      return;
    }

    setPosting(true);

    try {
      // 1) Create the post (root or child) with authorEmail
      const basePost = {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: postText,
        timestamp: serverTimestamp(),
        recipients,
        recipient: recipients[0] ?? null,
        authorEmail: user.email || null,

        rippleId: fromRippleId || 'pending',
        parentPostId: fromRippleId ? parent : null,
        generation: fromRippleId ? nextGen : 0,
      };

      const docRef = await addDoc(collection(db, 'posts'), basePost);

      // 2) If this is a root, set rippleId = this doc id
      let effectiveRippleId = fromRippleId;
      if (!fromRippleId) {
        effectiveRippleId = docRef.id;
        await setDoc(doc(db, 'posts', docRef.id), { rippleId: docRef.id }, { merge: true });
      }

      const postLink = `${window.location.origin}/post/${docRef.id}`;

      // 3) Send initial emails to new recipients (existing template)
      await Promise.all(
        recipients.map((to_email) =>
          emailjs.send(
            'service_28zemt7',
            'template_567fc2a',
            {
              to_email,
              from_name: user.displayName || 'Anonymous',
              post_text: postText,
              post_link: postLink,
              app_name: 'Ripple',
            },
            'q1XMFHhBE9upOF5cB'
          )
        )
      );

      // 4) If continuing a ripple, also notify prior participants (template_i631ek4)
      if (effectiveRippleId) {
        try {
          const qPart = query(
            collection(db, 'posts'),
            where('rippleId', '==', effectiveRippleId)
          );
          const snap = await getDocs(qPart);

          const participantEmails = new Set<string>();
          snap.forEach((d) => {
            const data = d.data() as Post;
            if (data.authorEmail) participantEmails.add(data.authorEmail);
          });

          // Don’t notify yourself or the newly-tagged recipients
          participantEmails.delete(user.email || '');
          recipients.forEach((r) => participantEmails.delete(r));

          const notifyList = Array.from(participantEmails);
          const rippleLink = `${window.location.origin}/ripple/${effectiveRippleId}?new=${docRef.id}`;

          await Promise.all(
            notifyList.map((to_email) =>
              emailjs.send(
                'service_28zemt7',
                'template_i631ek4',
                {
                  to_email,
                  from_name: user.displayName || 'Someone',
                  post_text: postText,
                  post_link: rippleLink,
                  app_name: 'Ripple',
                },
                'q1XMFHhBE9upOF5cB'
              )
            )
          );
        } catch (err) {
          console.error('Failed to notify ripple participants:', err);
        }
      }

      setText('');
      setEmail('');
    } catch (err: any) {
      console.error('Error posting ripple or sending email:', err?.text || err);
      alert(`Couldn’t send email: ${err?.text || 'Unknown error'}`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="timeline">
      <div className="ripple-composer">
        <form onSubmit={handlePostSubmit}>
          <textarea
            className="ripple-composer__textarea"
            placeholder="Create a ripple, describe your good deed..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="text"
            placeholder="Recipient email(s) — comma, space or semicolon separated"
            className="ripple-composer__email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="ripple-button__composer ripple-button "
            disabled={posting}
          >
            <RippleAnimation />
            <span>{posting ? 'Rippling...' : 'Create ripple'}</span>
          </button>

          {fromRippleId && (
            <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              Continuing ripple <code>{fromRippleId.slice(0, 6)}…</code> · Wave {nextGen}
            </p>
          )}
        </form>
        <WaveRipple />
      </div>

      {loading && <p className="loading">Loading ripples...</p>}
      {!loading && posts.length === 0 && <p className="text-center">No ripples yet.</p>}

      <div className="timeline-content">
        {posts.map(post => (
          <div key={post.id} className="timeline__post">
            <div className="timeline__post__content">
              <Link to={`/profile/${post.uid}`}>
                {post.photoURL && (
                  <img
                    src={post.photoURL}
                    alt="User avatar"
                    className="w-8 h-8 rounded-full mr-2"
                  />
                )}
              </Link>
              <span className="timeline__post__user">{post.displayName || 'Anonymous'}</span>
            </div>

            <Link to={`/post/${post.id}`} className="timeline__post__text rainbow-text">
              <SlabText text={post.text} paddingFactor={0.92} />
            </Link>

            {(post.recipients?.length || post.recipient) && (
              <p className="timeline__post_sent-to">
                @{post.recipients?.length ? post.recipients.join(', @') : post.recipient}
              </p>
            )}

            <div className="timeline__post__combo_line_element tl">
              <div className="timeline__post__like">
                <HeartButton
                  liked={userLikes[post.id]}
                  onClick={() => toggleLike(post.id)}
                />
                <span className="timeline__post__like_count">{likes[post.id] || 0}</span>
              </div>

              {(typeof post.generation === 'number' || post.rippleId) && (
                <div className="ripple-button-container">
                  {post.rippleId && (
                    <Link to={`/ripple/${post.rippleId}`} className="ripple-button">
                      <RippleAnimation /> View ripple
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="timeline__post__commentscontainewr tl">
              <div className="timeline__post__commentsform">
                <input
                  type="text"
                  placeholder="Add comment..."
                  value={newComment[post.id] || ''}
                  onChange={(e) =>
                    setNewComment((prev) => ({ ...prev, [post.id]: e.target.value }))
                  }
                  className="flex-1 border rounded p-1 text-sm mr-2"
                />
                <button
                  onClick={() => handleCommentSubmit(post.id)}
                  className="postcomment-button"
                  type="button"
                >
                  Post
                </button>
              </div>

              <div className="timeline__post__comments">
                {comments[post.id]?.map((comment) => (
                  <div key={comment.id} className="timeline__post__comment">
                    {comment.photoURL ? (
                      <img
                        src={comment.photoURL}
                        alt={comment.displayName || 'Anon'}
                        className="timeline__post__comment_profile"
                      />
                    ) : (
                      <div className="no-photo" />
                    )}
                    <p className="timeline__post__comment_text">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
