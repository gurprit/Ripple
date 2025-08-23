import type { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

      // Determine whose profile we’re showing
      const targetUid = viewingUid || self?.uid || null;

      if (!targetUid) {
        setProfile(null);
        setPosts([]);
        setRippleCount(0);
        setLoading(false);
        return;
      }

      // If you have a `users` collection, fetch from there. Otherwise:
      // Fallback profile data from their most recent post
      try {
        const latestQ = query(
          collection(db, 'posts'),
          where('uid', '==', targetUid),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const latestSnap = await getDocs(latestQ);
        const mostRecent = latestSnap.docs[0]?.data() as Partial<Post> | undefined;

        // Count their posts
        const countQ = query(collection(db, 'posts'), where('uid', '==', targetUid));
        const countSnap = await getDocs(countQ);

        setRippleCount(countSnap.size);
        setProfile({
          uid: targetUid,
          displayName: mostRecent?.displayName ?? (viewingUid ? 'Anonymous' : self?.displayName ?? 'You'),
          photoURL: mostRecent?.photoURL ?? (viewingUid ? null : self?.photoURL ?? null),
          email: viewingUid ? undefined : self?.email ?? undefined,
        });

        // Live list of their posts (newest first)
        const postsQ = query(
          collection(db, 'posts'),
          where('uid', '==', targetUid),
          orderBy('timestamp', 'desc')
        );
        unsubPosts = onSnapshot(postsQ, (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Post[];
          setPosts(rows);
          // Keep rippleCount in sync too (optional)
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

  return (
    <div className="profile content">
      <header>
        {profile.photoURL ? (
          <img
            src={profile.photoURL}
            alt={profile.displayName ?? 'User'}
            className="w-24 h-24 rounded-full mb-4"
            style={{ display: 'inline-block' }}
          />
        ) : (
          <div style={{ display: 'inline-block' }} />
        )}
        <h1>
          {profile.displayName || 'Anonymous'}
        </h1>
        {isSelf && profile.email && (
          <p>{profile.email}</p>
        )}

        <div>
          <div>
            <p>{rippleCount}</p>
            <p>Ripples</p>
          </div>
        </div>
      </header>

      {/* Posts list */}
      <section>
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          <div className="timeline">
            {posts.map((post) => (
              <article key={post.id} className="timeline__post">
                {/* Same header layout as timeline, but name/avatar are redundant here */}
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
                  <div className="ripple-button-container" style={{ marginTop: 8 }}>
                    {post.rippleId && (
                      <Link to={`/ripple/${post.rippleId}`} className="ripple-button">
                        View ripple
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
