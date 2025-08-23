import type { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

interface PublicProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string | null; // only for self
}

export default function ProfilePage() {
  const params = useParams<{ uid: string }>();
  const viewingUid = params.uid; // undefined means "self" route
  const [self, setSelf] = useState<User | null>(null);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [rippleCount, setRippleCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Track current user (for /profile and to detect “is this my own profile?”)
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setSelf);
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // CASE A: /profile (no :uid) → show current user
      if (!viewingUid) {
        if (!self) {
          setProfile(null);
          setRippleCount(0);
          setLoading(false);
          return;
        }

        // Count posts by self
        const q1 = query(collection(db, 'posts'), where('uid', '==', self.uid));
        const snap1 = await getDocs(q1);

        setRippleCount(snap1.size);
        setProfile({
          uid: self.uid,
          displayName: self.displayName ?? 'You',
          photoURL: self.photoURL ?? null,
          email: self.email ?? undefined,
        });
        setLoading(false);
        return;
      }

      // CASE B: /profile/:uid → public profile by UID
      // If you have a `users` collection, fetch from there here.
      // Fallback approach: look up their most recent post to get displayName/photoURL
      const postsQ = query(
        collection(db, 'posts'),
        where('uid', '==', viewingUid),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const postsSnap = await getDocs(postsQ);

      const countQ = query(collection(db, 'posts'), where('uid', '==', viewingUid));
      const countSnap = await getDocs(countQ);

      const mostRecent = postsSnap.docs[0]?.data() as any | undefined;
      setRippleCount(countSnap.size);
      setProfile({
        uid: viewingUid,
        displayName: mostRecent?.displayName ?? 'Anonymous',
        photoURL: mostRecent?.photoURL ?? null,
      });
      setLoading(false);
    })();
  }, [viewingUid, self]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>{viewingUid ? 'User not found.' : 'No user signed in.'}</p>
      </div>
    );
  }

  const isSelf = !viewingUid || viewingUid === self?.uid;

  return (
    <div className="profile flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <header className="text-center">
        {profile.photoURL ? (
          <img
            src={profile.photoURL}
            alt={profile.displayName ?? 'User'}
            className="w-24 h-24 rounded-full mb-4"
          />
        ) : (
          <div className="w-24 h-24 rounded-full mb-4 bg-gray-300" />
        )}
        <h1 className="text-2xl font-bold mb-2">
          {profile.displayName || 'Anonymous'}
        </h1>
        {isSelf && profile.email && (
          <p className="text-gray-600 mb-4">{profile.email}</p>
        )}
      </header>

      <div className="flex space-x-4">
        <div className="text-center">
          <p className="font-bold text-lg">{rippleCount}</p>
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
