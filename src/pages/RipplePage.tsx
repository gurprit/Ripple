import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import emailjs from '@emailjs/browser';
import WaveRipple from '../components/WaveRippleAnimation';
import SlabText from '../components/SlabText';
import RippleAnimation from '../components/RippleAnimation';
import HeartButton from '../components/HeartButton';

interface Post {
  id: string;
  text: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  timestamp: any;
  rippleId: string;
  parentPostId?: string | null;
  generation: number;
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

export default function RipplePage() {
  const { rippleId } = useParams<{ rippleId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Likes & comments state (per post)
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});

  // Always-visible composer
  const [composeText, setComposeText] = useState('');
  const [composeEmail, setComposeEmail] = useState('');
  const [posting, setPosting] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);

  // Highlight newly created post
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Read ?new= for highlight + clean URL after a short delay
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newId = params.get('new');
    if (newId) {
      setHighlightId(newId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const t = setTimeout(() => {
        setHighlightId(null);
        navigate(`/ripple/${rippleId}`, { replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [location.search, navigate, rippleId]);

  // Fetch posts NEWEST → OLDEST so latest is at the top
  useEffect(() => {
    if (!rippleId) return;
    const qy = query(
      collection(db, 'posts'),
      where('rippleId', '==', rippleId),
      orderBy('timestamp', 'desc')
    );
    // includeMetadataChanges → show pending writes instantly
    const unsub = onSnapshot(
      qy,
      { includeMetadataChanges: true },
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as Partial<Post>;
          return {
            id: d.id,
            text: data.text || '',
            uid: (data.uid as string) || '',
            displayName: data.displayName ?? null,
            photoURL: data.photoURL ?? null,
            timestamp: data.timestamp,
            rippleId: (data.rippleId as string) || rippleId,
            parentPostId: data.parentPostId ?? null,
            generation: typeof data.generation === 'number' ? data.generation : 0,
          } as Post;
        });
        setPosts(rows);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [rippleId]);

  // Subscribe to likes & comments per post
  useEffect(() => {
    if (!posts.length) return;
    const unsubs: Array<() => void> = [];

    posts.forEach((p) => {
      // Likes
      const likesRef = collection(db, 'posts', p.id, 'likes');
      const unsubLikes = onSnapshot(likesRef, (likeSnap) => {
        setLikes((prev) => ({ ...prev, [p.id]: likeSnap.size }));
        const uid = auth.currentUser?.uid;
        if (uid) {
          const likedByUser = likeSnap.docs.some((d) => d.id === uid);
          setUserLikes((prev) => ({ ...prev, [p.id]: likedByUser }));
        }
      });
      unsubs.push(unsubLikes);

      // Comments
      const commentsRef = collection(db, 'posts', p.id, 'comments');
      const commentsQ = query(commentsRef, orderBy('timestamp', 'asc'));
      const unsubComments = onSnapshot(commentsQ, (cSnap) => {
        const list = cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Comment[];
        setComments((prev) => ({ ...prev, [p.id]: list }));
      });
      unsubs.push(unsubComments);
    });

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [posts]);

  const newest = posts[0];

  const uniqueAuthors = new Set(posts.map((p) => p.displayName || p.id)).size;

  const toggleLike = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const likeRef = doc(db, 'posts', postId, 'likes', uid);
    const snap = await getDoc(likeRef);
    if (snap.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, { likedAt: Date.now() });
    }
  };

  const handleCommentSubmit = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    const text = (newComment[postId] || '').trim();
    if (!uid || !text) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      uid,
      displayName: user?.displayName || 'Anonymous',
      photoURL: user?.photoURL || null,
      text,
      timestamp: serverTimestamp(),
    });
    setNewComment((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rippleId) return;

    const user = auth.currentUser;
    const postText = composeText.trim();
    const rawEmail = composeEmail.trim();
    if (!user || !postText || !rawEmail) return;

    const recipients = rawEmail
      .split(/[,\s;]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    const bad = recipients.find((r) => !emailRegex.test(r));
    if (bad) {
      alert(`That email looks off: "${bad}". Please fix and try again.`);
      return;
    }

    setPosting(true);
    try {
      // Continue from the newest post by default
      const parentPostId = newest?.id || null;
      const nextGen = (newest?.generation ?? -1) + 1;

      // Create the doc
      const docRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: postText,
        timestamp: serverTimestamp(),
        recipients,
        recipient: recipients[0] ?? null,
        rippleId,
        parentPostId,
        generation: Math.max(nextGen, 0),
      });

      // Optimistically prepend the new post so UI updates immediately
      setPosts((prev) => {
        if (prev.some((p) => p.id === docRef.id)) return prev; // in case listener already added it
        const optimistic: Post = {
          id: docRef.id,
          uid: user.uid,
          text: postText,
          displayName: user.displayName ?? null,
          photoURL: user.photoURL ?? null,
          timestamp: { toMillis: () => Date.now() } as any, // client ts until server ts arrives
          rippleId,
          parentPostId,
          generation: Math.max(nextGen, 0),
        };
        return [optimistic, ...prev];
      });

      // Highlight immediately
      setHighlightId(docRef.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Ensure rippleId (defensive)
      await setDoc(doc(db, 'posts', docRef.id), { rippleId }, { merge: true });

      const postLink = `${window.location.origin}/post/${docRef.id}`;
      // Fire off emails, but UI is already updated
      await Promise.all(
        recipients.map((to_email) =>
          emailjs.send(
            'service_28zemt7',
            'template_567fc2a',
            { to_email, from_name: user.displayName || 'Anonymous', post_text: postText, post_link: postLink, app_name: 'Ripple' },
            'q1XMFHhBE9upOF5cB'
          )
        )
      );

      // Clear composer
      setComposeText('');
      setComposeEmail('');
    } catch (err: any) {
      console.error('Error posting ripple or sending email:', err?.text || err);
      alert(`Couldn’t send email: ${err?.text || 'Unknown error'}`);
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <div className="content">Loading ripple…</div>;

  return (
    <div className="ripple-detail">
    <Link to="/" className="back tl">
      ← Back to timeline
    </Link>
      <WaveRipple />
      {/* Always-visible composer */}
      <div ref={composerRef} className="ripple-composer">
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
            placeholder="Recipient email(s) — comma, space or semicolon separated"
            className="ripple-composer__email"
            value={composeEmail}
            onChange={(e) => setComposeEmail(e.target.value)}
            required
          />
          <button type="submit" className="ripple-button__composer ripple-button " disabled={posting}>
            <RippleAnimation />
            <span>{posting ? 'Rippling...' : 'Add to Ripple'}</span>
          </button>
        </form>
      </div>

      <h1 className="ripple-details-header">
        Posts <strong>{posts.length} </strong>
        People <strong>{uniqueAuthors} </strong>
      </h1>

      {/* NEWEST → OLDEST (root ends up at the bottom) */}
      {posts.length === 0 ? (
        <p className="content">No posts in this ripple yet.</p>
      ) : (
      <section className="timeline">

          {posts.map((p) => (
            <div
              className={`timeline__post ${highlightId === p.id ? 'timeline__post--highlight' : ''}`}
              key={p.id}
            >
              <div className="timeline__post__text rainbow-text">
                <div className="timeline__post__content">
                  {p.photoURL ? (
                    <Link to={`/profile/${p.uid}`}>
                      <img src={p.photoURL} alt="" />
                    </Link>
                  ) : (
                    <div />
                  )}
                  <span className="timeline__post__user">{p.displayName || 'Anonymous'}</span>
                </div>

                <Link to={`/post/${p.id}`} className="timeline__post__text rainbow-text">
                  <SlabText text={p.text} paddingFactor={0.92} />
                </Link>
              </div>


            <div className="timeline__post__combo_line_element">
                {/* Likes */}
                <div className="timeline__post__like">
                  <HeartButton
                    liked={!!userLikes[p.id]}
                    onClick={() => toggleLike(p.id)}
                  />
                  <span className="timeline__post__like_count">{likes[p.id] || 0}</span>
                </div>

                {/* Comments */}
                <div className="timeline__post__commentscontainewr">
                  <div className="timeline__post__commentsform">
                    <input
                      type="text"
                      placeholder="Add comment..."
                      value={newComment[p.id] || ''}
                      onChange={(e) =>
                        setNewComment((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="flex-1 border rounded p-1 text-sm mr-2"
                    />
                    <button
                      onClick={() => handleCommentSubmit(p.id)}
                      className="postcomment-button"
                      type="button"
                    >
                      Post
                    </button>
                  </div>

                  <div className="timeline__post__comments">
                    {comments[p.id]?.map((c) => (
                      <div key={c.id} className="timeline__post__comment">
                        {c.photoURL ? (
                          <img
                            src={c.photoURL}
                            alt={c.displayName || 'Anon'}
                            className="timeline__post__comment_profile"
                          />
                        ) : (
                          <div className="no-photo" />
                        )}
                        <span className="timeline__post__comment_text">{c.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
