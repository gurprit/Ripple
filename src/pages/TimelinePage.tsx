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

const EMAIL_DEBUG = false;
const SERVICE_ID = 'service_28zemt7';
const TEMPLATE_TAGGED = 'template_567fc2a';
const TEMPLATE_RIPPLE_UPDATED = 'template_i631ek4';
const TEMPLATE_COMMENT = 'template_rvhdgz4';
const PUBLIC_KEY = 'q1XMFHhBE9upOF5cB';

function sendEmailDBG(label: string, templateId: string, params: Record<string, any>) {
  if (EMAIL_DEBUG) {
    console.log(`[EMAIL TRY] ${label}`, { serviceId: SERVICE_ID, templateId, params });
  }
  return emailjs
    .send(SERVICE_ID, templateId, params, PUBLIC_KEY)
    .then(res => {
      if (EMAIL_DEBUG) console.log(`[EMAIL OK] ${label}`, { status: res.status, text: res.text });
      return res;
    })
    .catch(err => {
      console.error(`[EMAIL FAIL] ${label}`, err);
      throw err;
    });
}

interface Post {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;

  rippleId?: string;
  parentPostId?: string | null;
  generation?: number;

  recipients?: string[];
  recipient?: string | null;

  authorEmail?: string | null; // << used for notifications
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

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const fromRippleId = params.get('rippleId');
  const parent = params.get('parent');
  const nextGen = Number(params.get('gen') || '1');

  useEffect(() => {
    const qy = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(qy, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];

      if (EMAIL_DEBUG) console.log('[LOAD POSTS] timeline count =', fetchedPosts.length);

      setPosts(fetchedPosts);
      setLoading(false);

      fetchedPosts.forEach((post) => {
        const likesRef = collection(db, 'posts', post.id, 'likes');
        onSnapshot(likesRef, (likeSnapshot) => {
          setLikes((prev) => ({ ...prev, [post.id]: likeSnapshot.size }));
          const uid = auth.currentUser?.uid;
          if (uid) {
            const likedByUser = likeSnapshot.docs.some(doc => doc.id === uid);
            setUserLikes((prev) => ({ ...prev, [post.id]: likedByUser }));
          }
        });

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
      if (EMAIL_DEBUG) console.log('[LIKE] remove like for', postId);
      await deleteDoc(likeRef);
    } else {
      if (EMAIL_DEBUG) console.log('[LIKE] add like for', postId);
      await setDoc(likeRef, { likedAt: Date.now() });
    }
  };

  // COMMENT → notify post owner
  const handleCommentSubmit = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    const commentText = newComment[postId]?.trim();

    if (!uid || !commentText) {
      if (EMAIL_DEBUG) console.log('[COMMENT] blocked: uid or commentText missing', { uid, hasText: !!commentText });
      return;
    }

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const payload = {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text: commentText,
      timestamp: serverTimestamp(),
    };
    if (EMAIL_DEBUG) console.log('[COMMENT] addDoc payload', payload);
    await addDoc(commentsRef, payload);

    setNewComment((prev) => ({ ...prev, [postId]: '' }));

    try {
      const postSnap = await getDoc(doc(db, 'posts', postId));
      if (!postSnap.exists()) {
        console.warn('[COMMENT] postSnap missing for', postId);
        return;
      }
      const post = postSnap.data() as Post;
      const to_email = post.authorEmail || null;
      const from_name = user?.displayName || 'Anonymous';
      const post_link = `${window.location.origin}/post/${postId}`;
      if (EMAIL_DEBUG) console.log('[COMMENT] notify owner?', { to_email, equalsSelf: to_email === user?.email, post });

      if (to_email && to_email !== user?.email) {
        await sendEmailDBG('comment -> owner', TEMPLATE_COMMENT, {
          to_email,
          to_name: post.displayName || '',
          from_name,
          comment_text: commentText,
          post_link,
          app_name: 'Ripple',
        });
      } else {
        if (EMAIL_DEBUG) console.log('[COMMENT] skip notify (no to_email or self-comment)');
      }
    } catch (err) {
      console.error('[COMMENT] notify error', err);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const postText = text.trim();
    const rawEmail = email.trim();
    if (!postText || !rawEmail) {
      if (EMAIL_DEBUG) console.log('[NEW POST] blocked: missing text/email', { postText, rawEmail });
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      if (EMAIL_DEBUG) console.log('[NEW POST] blocked: no user');
      return;
    }

    const recipients = rawEmail.split(/[,\s;]+/).map(e => e.trim()).filter(Boolean);
    const bad = recipients.find(r => !emailRegex.test(r));
    if (bad) {
      alert(`That email looks off: "${bad}". Please fix and try again.`);
      return;
    }

    setPosting(true);

    try {
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
      if (EMAIL_DEBUG) console.log('[NEW POST] addDoc payload', basePost);

      const docRef = await addDoc(collection(db, 'posts'), basePost);

      // Set rippleId for root
      let effectiveRippleId = fromRippleId || docRef.id;
      if (!fromRippleId) {
        if (EMAIL_DEBUG) console.log('[NEW POST] setting rippleId (root)', docRef.id);
        await setDoc(doc(db, 'posts', docRef.id), { rippleId: docRef.id }, { merge: true });
      }

      const postLink = `${window.location.origin}/post/${docRef.id}`;

      // Email tagged recipients
      for (const to_email of recipients) {
        await sendEmailDBG('tagged (new post)', TEMPLATE_TAGGED, {
          to_email,
          from_name: user.displayName || 'Anonymous',
          post_text: postText,
          post_link: postLink,
          app_name: 'Ripple',
        });
      }

      // Notify prior participants if continuing
      if (effectiveRippleId) {
        try {
          const qPart = query(collection(db, 'posts'), where('rippleId', '==', effectiveRippleId));
          const snap = await getDocs(qPart);
          const participantEmails = new Set<string>();
          snap.forEach((d) => {
            const data = d.data() as Post;
            if (data.authorEmail) participantEmails.add(data.authorEmail);
          });
          participantEmails.delete(user.email || '');
          recipients.forEach((r) => participantEmails.delete(r));
          const notifyList = Array.from(participantEmails);
          if (EMAIL_DEBUG) console.log('[RIPPLE UPDATED] notifyList', notifyList);

          const rippleLink = `${window.location.origin}/ripple/${effectiveRippleId}?new=${docRef.id}`;
          for (const to_email of notifyList) {
            await sendEmailDBG('ripple updated', TEMPLATE_RIPPLE_UPDATED, {
              to_email,
              from_name: user.displayName || 'Someone',
              post_text: postText,
              post_link: rippleLink,
              app_name: 'Ripple',
            });
          }
        } catch (err) {
          console.error('[RIPPLE UPDATED] error collecting participants', err);
        }
      }

      setText('');
      setEmail('');
    } catch (err: any) {
      console.error('[NEW POST] error', err?.text || err);
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
          <button type="submit" className="ripple-button__composer ripple-button " disabled={posting}>
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
