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
      <h1 className="welcome">Welcome to Ripple</h1>
      <p className="intro">
        Share a good deed and inspire your friends.
      </p>
      <button
        onClick={handleGoogleLogin}
        className="sign-in">
        Sign in with Google
      </button>
    </div>
  );
}
