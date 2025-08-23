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
    <div className="welcome">
        <div className="content">
            <h1 className="rainbow-text">RIPPLE</h1>
            <p className="intro">Share good deeds</p>
            <p className="instructions">Tag friends, share good deeds, grow the ripple</p>
            <button
                onClick={handleGoogleLogin}
                className="sign-in">
                Sign in with Google
            </button>
      </div>
    </div>

  );
}
