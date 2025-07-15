// src/pages/LoginPage.tsx

import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/');  // Redirect to home after login
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6">Welcome to Ripple 🌊</h1>
      <p className="mb-4 text-gray-700 text-center">
        Share a good deed and inspire your friends.
      </p>
      <button
        onClick={handleGoogleLogin}
        className="flex items-center px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
      >
        Sign in with Google
      </button>
    </div>
  );
}
