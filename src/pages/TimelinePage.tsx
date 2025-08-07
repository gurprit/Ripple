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
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import emailjs from '@emailjs/browser';
import { useNavigate } from 'react-router-dom';
import SlabText from '../components/SlabText';
import HeartButton from '../components/HeartButton';
import { Link } from 'react-router-dom';

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
  photoURL: string | null;
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
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [posting, setPosting] = useState(false);
  const navigate = useNavigate();

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
    const commentText = newComment[postId]?.trim();

    if (!uid || !commentText) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      uid,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || null,
      text: commentText,
      timestamp: Date.now(),
    });

    setNewComment((prev) => ({ ...prev, [postId]: '' }));
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !email.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    setPosting(true);

    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: text.trim(),
        timestamp: serverTimestamp(),
      });

      const postLink = `${window.location.origin}/post/${docRef.id}`;

      await emailjs.send(
        'service_ypzr4dg',
        'template_567fc2a',
        {
          email: email,
          from_name: user.displayName || 'Anonymous',
          message: text.trim(),
          post_link: postLink,
        },
        'q1XMFHhBE9upOF5cB'
      );

      setText('');
      setEmail('');
    } catch (err) {
      console.error('Error posting ripple or sending email:', err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="timeline content">
      <div className="post">
        <form onSubmit={handlePostSubmit}>
          <textarea
            className="post__textarea"
            placeholder="Describe your good deed..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="email"
            placeholder="Recipient's email"
            className="post__email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="post-button"
            disabled={posting}
          >
            {posting ? 'Posting...' : 'Post & Send'}
          </button>
        </form>
      </div>

      {loading && <p className="loading">Loading ripples...</p>}
      {!loading && posts.length === 0 && <p className="text-center">No ripples yet.</p>}
      <div className="timeline">
        {posts.map(post => (
          <div key={post.id} className="timeline__post">
            <div className="timeline__post__content">
              {post.photoURL && (
                <img src={post.photoURL} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
              )}
              <span className="timeline__post__user">{post.displayName || 'Anonymous'}</span>
            </div>
            <Link to={`/post/${post.id}`} className="timeline__post__text rainbow-text">
              <SlabText text={post.text} paddingFactor={0.92} />
            </Link>
            {post.recipient && (
              <p className="timeline__post_sent-to">@{post.recipient}</p>
            )}
            <div className="timeline__post__like">
            <HeartButton
              liked={userLikes[post.id]}
              onClick={() => toggleLike(post.id)}
            />
            <span className="timeline__post__like_count">{likes[post.id] || 0}</span>
            </div>
            <div className="timeline__post__commentscontainewr">
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
                  <span className="timeline__post__comment_text">{comment.text}</span>
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
