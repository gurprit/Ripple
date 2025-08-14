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
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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

  // Inline composer for ripple continuation
  const [showComposer, setShowComposer] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeEmail, setComposeEmail] = useState('');
  const [posting, setPosting] = useState(false);

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

  const submitComment = async () => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    if (!uid || !id || !newComment.trim()) return;
    const commentsRef = collection(db, 'posts', id, 'comments');
    await addDoc(commentsRef, {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text: newComment.trim(),
      timestamp: serverTimestamp(),
    });
    setNewComment('');
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
      const rippleId = post.rippleId || post.id; // fallback for older posts
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
      });

      await setDoc(doc(db, 'posts', docRef.id), { rippleId }, { merge: true });

      const postLink = `${window.location.origin}/post/${docRef.id}`;
      await Promise.all(
        recipients.map((to_email) =>
          emailjs.send(
            'service_ypzr4dg',
            'template_567fc2a',
            { to_email, from_name: user.displayName || 'Anonymous', post_text: postText, post_link: postLink, app_name: 'Ripple' },
            'q1XMFHhBE9upOF5cB'
          )
        )
      );

      // Jump to the ripple page and highlight the new post
      navigate(`/ripple/${rippleId}?new=${docRef.id}`);

    } catch (err: any) {
      console.error('Error posting ripple or sending email:', err?.text || err);
      alert(`Couldn’t send email: ${err?.text || 'Unknown error'}`);
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <p className="text-center mt-10">Loading ripple...</p>;
  if (!post)   return <p className="text-center mt-10">Ripple not found.</p>;

  const nextGen = (post.generation ?? 0) + 1;

  return (
    <div className="timeline">
      <Link to="/" className="">
        ← Back to timeline
      </Link>

      <div className="timeline__post">
        <div className="timeline__post__content">
          {post.photoURL && <img src={post.photoURL} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />}
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

        {(typeof post.generation === 'number' || post.rippleId) && (
          <div className="ripple-button-container">
            {post.rippleId && (
              <Link to={`/ripple/${post.rippleId}`} className="ripple-button">
                <RippleAnimation /> View ripple
              </Link>
            )}
          </div>
        )}



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
            />
            <button onClick={submitComment} className="postcomment-button" type="button">Post</button>
          </div>

          <div className="timeline__post__comments">
            {comments.map((c) => (
              <div key={c.id} className="timeline__post__comment">
                {c.photoURL ? (
                  <img src={c.photoURL} alt={c.displayName || 'Anon'} className="timeline__post__comment_profile" />
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full mr-2" />
                )}
                <div><p className="timeline__post__comment_text">{c.text}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="ripple-composer-container">
          {!showComposer ? (
            <button
              onClick={() => setShowComposer(true)}
              className="ripple-button large"
            ><RippleAnimation />
              Tag someone keep it going
            </button>
            



          ) : (
            <div className="post" style={{ marginTop: 8 }}>
              <form onSubmit={handleInlineSubmit}>
                <textarea
                  className="post__textarea"
                  placeholder="Describe your good deed..."
                  rows={4}
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Recipient email(s) — comma, space or semicolon separated"
                  className="post__email"
                  value={composeEmail}
                  onChange={(e) => setComposeEmail(e.target.value)}
                  required
                />
                <button type="submit" className="post-button" disabled={posting}>
                  {posting ? 'Posting...' : 'Post & Send'}
                </button>
                <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  Continuing ripple <code>{(post.rippleId || post.id).slice(0, 6)}…</code> · Wave {nextGen}
                </p>
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
                  className="px-2 py-1"
                  style={{ fontSize: 12, color: '#6b7280', textDecoration: 'underline', marginTop: 6 }}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
