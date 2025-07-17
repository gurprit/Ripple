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
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface Post {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;
}

interface Comment {
  id: string;
  uid: string;
  displayName: string | null;
  text: string;
  timestamp: any;
}

export default function TimelinePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<{ [postId: string]: number }>({});
  const [userLikes, setUserLikes] = useState<{ [postId: string]: boolean }>({});
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});

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
        // Listen for likes
        const likesRef = collection(db, 'posts', post.id, 'likes');
        onSnapshot(likesRef, (likeSnapshot) => {
          setLikes((prev) => ({
            ...prev,
            [post.id]: likeSnapshot.size,
          }));
          const uid = auth.currentUser?.uid;
          if (uid) {
            const likedByUser = likeSnapshot.docs.some(doc => doc.id === uid);
            setUserLikes((prev) => ({
              ...prev,
              [post.id]: likedByUser,
            }));
          }
        });

        // Listen for comments
        const commentsRef = collection(db, 'posts', post.id, 'comments');
        const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
        onSnapshot(commentsQuery, (commentSnapshot) => {
          const fetchedComments = commentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Comment[];
          setComments((prev) => ({
            ...prev,
            [post.id]: fetchedComments,
          }));
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

  const handleCommentSubmit = async (postId: string) => {
    const uid = auth.currentUser?.uid;
    const user = auth.currentUser;
    const text = newComment[postId]?.trim();

    if (!uid || !text) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      uid,
      displayName: user.displayName || 'Anonymous',
      text,
      timestamp: Date.now(),
    });

    setNewComment((prev) => ({ ...prev, [postId]: '' }));
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Timeline</h1>
      {loading && <p className="text-center">Loading ripples...</p>}
      {!loading && posts.length === 0 && <p className="text-center">No ripples yet.</p>}
      {posts.map(post => (
        <div key={post.id} className="bg-white rounded shadow p-4 mb-4">
          <div className="flex items-center mb-2">
            {post.photoURL && (
              <img src={post.photoURL} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
            )}
            <span className="font-semibold">{post.displayName || 'Anonymous'}</span>
          </div>
          <p className="mb-2">{post.text}</p>
          \  {post.recipient && (
    <p className="text-sm text-gray-500 mb-2">🌱 Sent to: {post.recipient}</p>
  )}
          <div className="flex items-center mb-2">
            <button
              onClick={() => toggleLike(post.id)}
              className={`text-sm mr-2 ${userLikes[post.id] ? 'text-red-500' : 'text-gray-500'} hover:underline`}
            >
              ❤️ {likes[post.id] || 0}
            </button>
          </div>

          {/* Comments */}
          <div className="comments mb-2">
            {comments[post.id]?.map((comment) => (
              <div key={comment.id} className="text-sm text-gray-700 mb-1">
                <span className="font-semibold">{comment.displayName || 'Anon'}:</span> {comment.text}
              </div>
            ))}
          </div>

          <div className="flex items-center">
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
              className="text-sm text-blue-500 hover:underline"
            >
              Post
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
