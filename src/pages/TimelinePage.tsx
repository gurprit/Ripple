import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Post {
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

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(fetchedPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <div className="max-w-md mx-auto mt-10 p-4">
        <h1 className="text-2xl font-bold mb-4 text-center">Timeline</h1>
        {loading && <p className="text-center">Loading ripples...</p>}
        {!loading && posts.length === 0 && <p className="text-center">No ripples yet.</p>}
        {posts.map(post => (
          <div key={post.id} className="timeline__post">
            <div className="timeline__post__content">
              {post.photoURL && (
                <img src={post.photoURL} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
              )}
              <span className="timeline__post__name">{post.displayName || 'Anonymous'}</span>
            </div>
            
            <p className="timeline__post__text">{post.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
