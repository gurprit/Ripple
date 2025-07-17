import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Post {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() } as Post);
      }
      setLoading(false);
    };

    fetchPost();
  }, [id]);

  if (loading) return <p className="text-center mt-10">Loading ripple...</p>;
  if (!post) return <p className="text-center mt-10">Ripple not found.</p>;

  return (
    <div className="max-w-md mx-auto mt-10 p-4 bg-white rounded shadow">
      <Link to="/" className="text-blue-500 hover:underline text-sm">← Back to timeline</Link>
      <div className="mt-4">
        <div className="flex items-center mb-2">
          {post.photoURL && (
            <img src={post.photoURL} alt="User avatar" className="w-8 h-8 rounded-full mr-2" />
          )}
          <span className="font-semibold">{post.displayName || 'Anonymous'}</span>
        </div>
        <p className="text-lg">{post.text}</p>
      </div>
    </div>
  );
}
