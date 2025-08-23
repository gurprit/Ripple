import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';

export default function PostPage() {
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !email.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);

    try {
      // 1️⃣ Add post to Firestore
      const docRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: text.trim(),
        timestamp: serverTimestamp(),
      });

      // 2️⃣ Build post link
      const postLink = `${window.location.origin}/post/${docRef.id}`;

      // 3️⃣ Send email with post link
      await emailjs.send(
        'service_28zemt7',
        'template_567fc2a',
        {
          email: email,
          from_name: user.displayName || 'Anonymous',
          message: text.trim(),
          post_link: postLink,
        },
        'q1XMFHhBE9upOF5cB'
      );

      setLoading(false);
      setText('');
      setEmail('');
      navigate('/');
    } catch (err) {
      console.error('Error posting ripple or sending email:', err);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 bg-white rounded shadow">
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full border rounded p-2 mb-4"
          placeholder="Describe your good deed..."
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="email"
          placeholder="Recipient's email"
          className="w-full border rounded p-2 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? 'Posting...' : 'Post & Send'}
        </button>
      </form>
    </div>
  );
}
