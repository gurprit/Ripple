import type { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit
} from 'firebase/firestore';
import SlabText from '../components/SlabText';
import RippleAnimation from '../components/RippleAnimation';

interface PublicProfile {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email?: string | null; // only shown for self
}

interface Post {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  timestamp: any;
  rippleId?: string;
  parentPostId?: string | null;
  generation?: number;
}

export default function ProfilePage() {
  const params = useParams<{ uid: string }>();
  const viewingUid = params.uid || null;
  const navigate = useNavigate();

  const [self, setSelf] = useState<User | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [rippleCount, setRippleCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Track current user
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setSelf);
    return unsub;
  }, []);

  // Load profile info + count (and subscribe to posts) for either self or :uid
  useEffect(() => {
    let unsubPosts: (() => void) | undefined;
    (async () => {
      setLoading(true);

      const targetUid = viewingUid || self?.uid || null;
      if (!targetUid) {
        setProfile(null);
        setPosts([]);
        setRippleCount(0);
        setLoading(false);
        return;
      }

      try {
        const latestQ = query(
          collection(db, 'posts'),
          where('uid', '==', targetUid),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const latestSnap = await getDocs(latestQ);
        const mostRecent = latestSnap.docs[0]?.data() as Partial<Post> | undefined;

        const countQ = query(collection(db, 'posts'), where('uid', '==', targetUid));
        const countSnap = await getDocs(countQ);

        setRippleCount(countSnap.size);
        setProfile({
          uid: targetUid,
          displayName: mostRecent?.displayName ?? (viewingUid ? 'Anonymous' : self?.displayName ?? 'You'),
          photoURL: mostRecent?.photoURL ?? (viewingUid ? null : self?.photoURL ?? null),
          email: viewingUid ? undefined : self?.email ?? undefined,
        });

        const postsQ = query(
          collection(db, 'posts'),
          where('uid', '==', targetUid),
          orderBy('timestamp', 'desc')
        );
        unsubPosts = onSnapshot(postsQ, (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Post[];
          setPosts(rows);
          setRippleCount(snap.size);
          setLoading(false);
        });
      } catch (e) {
        console.error('Failed to load profile/posts:', e);
        setLoading(false);
      }
    })();

    return () => {
      if (unsubPosts) unsubPosts();
    };
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

  const handleSignOut = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="profile content" >
      <header className="text-center" style={{ marginBottom: 16 }}>
        {profile.photoURL ? (
          <img
            src={profile.photoURL}
            alt={profile.displayName ?? 'User'}
            className="w-24 h-24 rounded-full mb-4"
            style={{ display: 'inline-block' }}
          />
        ) : (
          <div className="w-24 h-24 rounded-full mb-4 bg-gray-300" style={{ display: 'inline-block' }} />
        )}
        <h1 className="text-2xl font-bold mb-1">
          {profile.displayName || 'Anonymous'}
        </h1>
        {isSelf && profile.email && (
          <p className="text-gray-600 mb-2">{profile.email}</p>
        )}

        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="text-center">
            <p className="font-bold text-lg">{rippleCount}</p>
            <p className="text-sm text-gray-500">Ripples</p>
          </div>
        </div>

        {isSelf && (
          <button
            onClick={handleSignOut}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign out
          </button>
        )}
      </header>

      {/* Posts list */}
      <section>
        {posts.length === 0 ? (
          <p className="text-gray-500">No posts yet.</p>
        ) : (
          <div className="timeline">
            {posts.map((post) => (
              <article key={post.id} className="timeline__post">

                <div className="timeline__post__content">
                  {post.photoURL ? (
                   <Link to={`/profile/${post.uid}`}>
                    <img
                      src={post.photoURL}
                      alt={post.displayName || 'User'}
                      className="w-8 h-8 rounded-full mr-2"
                    />
                    </Link>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 mr-2" />
                  )}
                  <span className="timeline__post__user">{post.displayName || 'Anonymous'}</span>
                </div>

                <Link to={`/post/${post.id}`} className="timeline__post__text rainbow-text">
                  <SlabText text={post.text} paddingFactor={0.92} />
                </Link>

                {(post.rippleId || typeof post.generation === 'number') && (
                  <div className="ripple-button-container">
                    {post.rippleId && (
                      <Link to={`/ripple/${post.rippleId}`} className="ripple-button">
                         <RippleAnimation /> View ripple
                      </Link>
                    )}
                  </div>
                )}

              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
