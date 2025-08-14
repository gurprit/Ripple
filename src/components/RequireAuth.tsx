// src/components/RequireAuth.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { auth } from '../services/firebase';
import type { User } from 'firebase/auth';
import { Navigate, useLocation } from 'react-router-dom';
import NavBar from './NavBar';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      {children}
      <NavBar />
    </>
  );
}
