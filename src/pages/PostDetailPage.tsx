import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  deleteDoc,
  setDoc,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import emailjs from '@emailjs/browser';
import HeartButton from '../components/HeartButton';
import SlabText from '../components/SlabText';
import RippleAnimation from '../components/RippleAnimation';

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

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const [showComposer, setShowComposer] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeEmail, setComposeEmail] = useState('');
  const [posting, setPosting] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const isAuthed = !!currentUser;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const docRef = doc(db, 'posts', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() } as Post);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const likesRef = collection(db, 'posts', id, 'likes');
    const unsub = onSnapshot(likesRef, snap => {
      setLikeCount(snap.size);
      const uid = auth.currentUser?.uid;
      if (uid) setUserLiked(snap.docs.some(d => d.id === uid));
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const commentsRef = collection(db, 'posts', id, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    });
    return () => unsub();
  }, [id]);

  const toggleLike = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) return;
    const likeRef = doc(db, 'posts', id, 'likes', uid);
    const likeSnap = await getDoc(likeRef);
    if (likeSnap.exists()) await deleteDoc(likeRef);
    else await setDoc(likeRef, { likedAt: Date.now() });
  };

  // COMMENT: now sends email to the post author
  const submitComment = async () => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    if (!uid || !id || !newComment.trim()) return;
    const commentsRef = collection(db, 'posts', id, 'comments');
    const commentText = newComment.trim();

    await addDoc(commentsRef, {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text: commentText,
      timestamp: serverTimestamp(),
    });
    setNewComment('');

    try {
      const postSnap = await getDoc(doc(db, 'posts', id));
      if (postSnap.exists()) {
        const p = postSnap.data() as Post;
        const to_email = p.authorEmail || null;
        const from_name = user?.displayName || 'Anonymous';
        if (to_email && to_email !== user?.email) {
          const post_link = `${window.location.origin}/post/${id}`;
          await emailjs.send(
            'service_28zemt7',
            'template_rvhdgz4',
            {
              to_email,
              to_name: p.displayName || '',
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

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;

    const user = auth.currentUser;
    const postText = composeText.trim();
    const rawEmail = composeEmail.trim();
    if (!user || !postText || !rawEmail) return;

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
      const rippleId = post.rippleId || post.id;
      const nextGen = (post.generation ?? 0) + 1;

      const docRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: postText,
        timestamp: serverTimestamp(),
        recipients,
        recipient: recipients[0] ?? null,
        rippleId,
        parentPostId: post.id,
        generation: nextGen,
        authorEmail: user.email || null,
      });

      await setDoc(doc(db, 'posts', docRef.id), { rippleId }, { merge: true });

      const post_link = `${window.location.origin}/post/${docRef.id}`;

      // 1) Email new recipients
      await Promise.all(
        recipients.map((to_email) =>
          emailjs.send(
            'service_28zemt7',
            'template_567fc2a',
            { to_email, from_name: user.displayName || 'Anonymous', post_text: postText, post_link, app_name: 'Ripple' },
            'q1XMFHhBE9upOF5cB'
          )
        )
      );

      // 2) Notify prior participants
      try {
        const qPart = query(collection(db, 'posts'), where('rippleId', '==', rippleId));
        const snap = await getDocs(qPart);
        const participantEmails = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as Post;
          if (data.authorEmail) participantEmails.add(data.authorEmail);
        });
        participantEmails.delete(user.email || '');
        recipients.forEach((r) => participantEmails.delete(r));

        const notifyList = Array.from(participantEmails);
        const rippleLink = `${window.location.origin}/ripple/${rippleId}?new=${docRef.id}`;

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

      navigate(`/ripple/${rippleId}?new=${docRef.id}`);
    } catch (err: any) {
      console.error('Error posting ripple or sending email:', err?.text || err);
      alert(`Couldn’t send email: ${err?.text || 'Unknown error'}`);
    } finally {
      setPosting(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowComposer(true);
    } catch (e: any) {
      console.error('Google sign-in failed:', e?.message || e);
      alert('Sign-in failed. Please try again.');
    }
  };

  if (loading) return <p className="text-center mt-10">Loading ripple...</p>;
  if (!post)   return <p className="text-center mt-10">Ripple not found.</p>;

  const nextGen = (post.generation ?? 0) + 1;

  return (
    <div className="timeline">
      <Link to="/" className="back tl">← Back to timeline</Link>

      <div className="timeline__post">
        <div className="timeline__post__content">
          {post.photoURL && <Link to={`/profile/${post.uid}`}><img src={post.photoURL} alt="User avatar" /></Link>}
          <span className="timeline__post__user">{post.displayName || 'Anonymous'}</span>
        </div>

        <div className="timeline__post__text rainbow-text">
          <SlabText text={post.text} paddingFactor={0.92} />
        </div>

        {(post.recipients?.length || post.recipient) && (
          <p className="timeline__post_sent-to">
            @{post.recipients?.length ? post.recipients.join(', @') : post.recipient}
          </p>
        )}

        <div className='timeline__post__combo_line_element col-on-mobile'>
          {!isAuthed ? (
            <div onClick={loginWithGoogle} className="ripple-button large">
              Login with Google
            </div>
          ) : !showComposer ? (
            <div onClick={() => setShowComposer(true)} className="ripple-button-container">
              <div className="ripple-button">
                <RippleAnimation />
                Tag someone keep it going
              </div>
            </div>
          ) : (
            <div className="ripple-composer">
              <form onSubmit={handleInlineSubmit}>
                <textarea
                  className="ripple-composer__textarea"
                  placeholder="Continue ripple, describe your good deed..."
                  rows={4}
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                />
                <input
                  type="text"
                  className="ripple-composer__email"
                  placeholder="Recipient email(s) — comma, space or semicolon separated"
                  value={composeEmail}
                  onChange={(e) => setComposeEmail(e.target.value)}
                  required
                />
                <button type="submit" className="ripple-button__composer ripple-button " disabled={posting}>
                  <RippleAnimation />
                  <span>{posting ? 'Rippling...' : 'Add to Ripple'}</span>
                </button>
                <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  Continuing ripple <code>{(post.rippleId || post.id).slice(0, 6)}…</code> · Ripple {nextGen}
                </p>
                <button type="button" onClick={() => setShowComposer(false)}>Close</button>
              </form>
            </div>
          )}

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

        <div className="timeline__post__combo_line_element">
          {/* Likes */}
          <div className="timeline__post__like">
            <HeartButton liked={userLiked} onClick={toggleLike} />
            <span className="timeline__post__like_count">{likeCount}</span>
          </div>

          {/* Comments */}
          <div className="timeline__post__commentscontainewr">
            <div className="timeline__post__commentsform">
              <input
                type="text"
                placeholder="Add comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 border rounded p-1 text-sm mr-2"
                disabled={!isAuthed}
              />
              <button onClick={submitComment} className="postcomment-button" type="button" disabled={!isAuthed}>
                Post
              </button>
            </div>

            <div className="timeline__post__comments">
              {comments.map((c) => (
                <div key={c.id} className="timeline__post__comment">
                  {c.photoURL ? (
                    <img src={c.photoURL} alt={c.displayName || 'Anon'} className="timeline__post__comment_profile" />
                  ) : (
                    <div className="w-6 h-6 bg-gray-300 rounded-full mr-2" />
                  )}
                  <p className="timeline__post__comment_text">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
