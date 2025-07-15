import { auth } from '../services/firebase';
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';


export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (

    <div className="profile flex flex-col items-center justify-center h-screen bg-gray-100 p-4">

    <header>
        <img
        src={user.photoURL ?? ''}
        alt={user.displayName ?? 'User'}
        className="w-24 h-24 rounded-full mb-4"
        />
        <h1 className="text-2xl font-bold mb-2">{user.displayName}</h1>
        <p className="text-gray-600 mb-4">{user.email}</p>
      </header>
      

      {/* Placeholder stats */}
      <div className="flex space-x-4">
        <div className="text-center">
          <p className="font-bold text-lg">0</p>
          <p className="text-sm text-gray-500">Ripples</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">0</p>
          <p className="text-sm text-gray-500">Friends</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-lg">0</p>
          <p className="text-sm text-gray-500">Likes</p>
        </div>
      </div>
    </div>
  );
}
