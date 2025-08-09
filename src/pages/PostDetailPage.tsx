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

  // Ripple fields (new)
  rippleId?: string;
  parentPostId?: string | null;
  generation?: number;

  // Recipients (existing compatibility)
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

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  // Likes state
  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState(''); // <-- single input (your previous code had a map by mistake)

  // Fetch post once
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

  // Subscribe to likes
  useEffect(() => {
    if (!id) return;
    const likesRef = collection(db, 'posts', id, 'likes');
    const unsub = onSnapshot(likesRef, snap => {
      setLikeCount(snap.size);
      const uid = auth.currentUser?.uid;
      if (uid) {
        setUserLiked(snap.docs.some(d => d.id === uid));
      }
    });
    return () => unsub();
  }, [id]);

  // Subscribe to comments
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
    if (likeSnap.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, { likedAt: Date.now() });
    }
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

  if (loading) return <p className="text-center mt-10">Loading ripple...</p>;
  if (!post)   return <p className="text-center mt-10">Ripple not found.</p>;

  const nextGen = (post.generation ?? 0) + 1;

  return (
    <div className="timeline">
      <Link to="/" className="">
        ← Back to timeline
      </Link>

      {/* Post content */}
      <div className="timeline__post">
        <div className="timeline__post__content">
          {post.photoURL && (
            <img
              src={post.photoURL}
              alt="User avatar"
              className="w-8 h-8 rounded-full mr-2"
            />
          )}
          <span className="timeline__post__user">{post.displayName || 'Anonymous'}</span>
        </div>

        <div className="timeline__post__text rainbow-text">
          <SlabText text={post.text} paddingFactor={0.92} />
        </div>

        {(post.recipients?.length || post.recipient) && (
          <p className="timeline__post_sent-to">
            @{
              post.recipients?.length
                ? post.recipients.join(', @')
                : post.recipient
            }
          </p>
        )}

            {/* Ripple snippet */}
            {(typeof post.generation === 'number' || post.rippleId) && (
              <div className="ripple-button-container">
                {post.rippleId && (
                  <Link to={`/ripple/${post.rippleId}`} className="ripple-button">
                    <RippleAnimation /> View ripple
                  </Link>
                )}
              </div>
            )}

        <div className="mt-3">
          <button
            onClick={() =>
              navigate(`/?rippleId=${post.rippleId}&parent=${post.id}&gen=${nextGen}`)
            }
            className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
          >
            Tag someone — keep it going
          </button>
        </div>

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
            <button
              onClick={submitComment}
              className="postcomment-button"
              type="button"
            >
              Post
            </button>
          </div>

          <div className="timeline__post__comments">
            {comments.map((c) => (
              <div key={c.id} className="timeline__post__comment">
                {c.photoURL ? (
                  <img
                    src={c.photoURL}
                    alt={c.displayName || 'Anon'}
                    className="timeline__post__comment_profile"
                  />
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full mr-2" />
                )}
                <div>
                  <p className="timeline__post__comment_text">{c.text}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
