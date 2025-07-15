import { useState } from 'react';
import { addDoc, collection, serverTimestamp, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { useNavigate } from 'react-router-dom';

// Initialize Firebase app and services
const app = getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export default function PostPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    try {
      await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: text.trim(),
        timestamp: serverTimestamp(),
      });
      setLoading(false);
      setText('');
      navigate('/');
    } catch (err) {
      console.error('Error posting ripple:', err);
      setLoading(false);
    }
  };

  return (
    <>

      <div className="max-w-md mx-auto mt-10 p-4 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">Post</h1>
        <form onSubmit={handleSubmit}>
          <textarea
            className="w-full border rounded p-2 mb-4"
            placeholder="Describe your good deed..."
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            disabled={loading}
          >
            {loading ? 'Posting...' : 'Post Ripple'}
          </button>
        </form>
      </div>
    </>
  );
}
