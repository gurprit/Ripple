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

const EMAIL_DEBUG = true;
const SERVICE_ID = 'service_28zemt7';
const TEMPLATE_TAGGED = 'template_567fc2a';
const TEMPLATE_RIPPLE_UPDATED = 'template_i631ek4';
const TEMPLATE_COMMENT = 'template_rvhdgz4';
const PUBLIC_KEY = 'q1XMFHhBE9upOF5cB';

function sendEmailDBG(label: string, templateId: string, params: Record<string, any>) {
  if (EMAIL_DEBUG) console.log(`[EMAIL TRY] ${label}`, { serviceId: SERVICE_ID, templateId, params });
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
        const p = { id: snap.id, ...snap.data() } as Post;
        if (EMAIL_DEBUG) console.log('[POST DETAIL LOAD]', p);
        setPost(p);
      } else {
        if (EMAIL_DEBUG) console.log('[POST DETAIL LOAD] not found', id);
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
    const qy = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(qy, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(rows);
    });
    return () => unsub();
  }, [id]);

  const toggleLike = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !id) return;
    const likeRef = doc(db, 'posts', id, 'likes', uid);
    const likeSnap = await getDoc(likeRef);
    if (likeSnap.exists()) {
      if (EMAIL_DEBUG) console.log('[LIKE] remove on post', id);
      await deleteDoc(likeRef);
    } else {
      if (EMAIL_DEBUG) console.log('[LIKE] add on post', id);
      await setDoc(likeRef, { likedAt: Date.now() });
    }
  };

  // COMMENT → notify owner
  const submitComment = async () => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    if (!uid || !id || !newComment.trim()) {
      if (EMAIL_DEBUG) console.log('[COMMENT] blocked on post', { uid, id, hasText: !!newComment.trim() });
      return;
    }
    const commentsRef = collection(db, 'posts', id, 'comments');
    const commentText = newComment.trim();
    const payload = {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text: commentText,
      timestamp: serverTimestamp(),
    };
    if (EMAIL_DEBUG) console.log('[COMMENT] addDoc payload (post)', payload);
    await addDoc(commentsRef, payload);
    setNewComment('');

    try {
      const postSnap = await getDoc(doc(db, 'posts', id));
      if (!postSnap.exists()) {
        console.warn('[COMMENT] post not found for notify', id);
        return;
      }
      const p = postSnap.data() as Post;
      const to_email = p.authorEmail || null;
      if (EMAIL_DEBUG) console.log('[COMMENT] notify owner (post)?', { to_email, equalsSelf: to_email === user?.email, p });

      if (to_email && to_email !== user?.email) {
        const post_link = `${window.location.origin}/post/${id}`;
        await sendEmailDBG('comment -> owner', TEMPLATE_COMMENT, {
          to_email,
          to_name: p.displayName || '',
          from_name: user?.displayName || 'Anonymous',
          comment_text: commentText,
          post_link,
          app_name: 'Ripple',
        });
      } else {
        if (EMAIL_DEBUG) console.log('[COMMENT] skip owner notify (post) - no email or self');
      }
    } catch (err) {
      console.error('[COMMENT] notify error (post)', err);
    }
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;

    const user = auth.currentUser;
    const postText = composeText.trim();
    const rawEmail = composeEmail.trim();
    if (!user || !postText || !rawEmail) {
      if (EMAIL_DEBUG) console.log('[CONTINUE RIPPLE] blocked', { hasUser: !!user, hasText: !!postText, hasEmail: !!rawEmail });
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
      const rippleId = post.rippleId || post.id;
      const nextGen = (post.generation ?? 0) + 1;

      const payload = {
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
      };
      if (EMAIL_DEBUG) console.log('[CONTINUE RIPPLE] addDoc payload', payload);

      const docRef = await addDoc(collection(db, 'posts'), payload);

      await setDoc(doc(db, 'posts', docRef.id), { rippleId }, { merge: true });

      const post_link = `${window.location.origin}/post/${docRef.id}`;

      // 1) Email new recipients
      for (const to_email of recipients) {
        await sendEmailDBG('tagged (continue ripple)', TEMPLATE_TAGGED, {
          to_email,
          from_name: user.displayName || 'Anonymous',
          post_text: postText,
          post_link,
          app_name: 'Ripple',
        });
      }

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
        if (EMAIL_DEBUG) console.log('[RIPPLE UPDATED] notifyList (post detail)', notifyList);

        const rippleLink = `${window.location.origin}/ripple/${rippleId}?new=${docRef.id}`;
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
        console.error('[RIPPLE UPDATED] error (post detail)', err);
      }

      navigate(`/ripple/${rippleId}?new=${docRef.id}`);
    } catch (err: any) {
      console.error('[CONTINUE RIPPLE] error', err?.text || err);
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
      <Link to="/" className="back tl">Back to timeline</Link>

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
          <div className="timeline__post__like">
            <HeartButton liked={userLiked} onClick={toggleLike} />
            <span className="timeline__post__like_count">{likeCount}</span>
          </div>

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
