import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Post {
  id: string;
  text: string;
  displayName: string | null;
  photoURL: string | null;
  timestamp: any;
  rippleId: string;
  parentPostId?: string | null;
  generation: number;
}

export default function RipplePage() {
  const { rippleId } = useParams<{ rippleId: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rippleId) return;
    const qy = query(
      collection(db, 'posts'),
      where('rippleId', '==', rippleId),
      orderBy('generation', 'asc'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Partial<Post>;
        return {
          id: d.id,
          text: data.text || '',
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
          timestamp: data.timestamp,
          rippleId: (data.rippleId as string) || rippleId,
          parentPostId: data.parentPostId ?? null,
          generation: typeof data.generation === 'number' ? data.generation : 0,
        } as Post;
      });
      setPosts(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [rippleId]);

  const root = useMemo(() => posts.find((p) => p.generation === 0), [posts]);

  if (loading) return <div className="content">Loading ripple…</div>;
  if (!posts.length) return <div className="content">No posts in this ripple yet.</div>;

  const byGen = posts.reduce<Record<number, Post[]>>((acc, p) => {
    (acc[p.generation] ||= []).push(p);
    return acc;
  }, {});
  const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);

  const uniqueAuthors = new Set(posts.map((p) => p.displayName || p.id)).size;
  const maxDepth = Math.max(...gens);

  return (
    <div className="content" style={{ maxWidth: 800, margin: '24px auto', padding: '0 16px' }}>
      <Link to="/" className="text-blue-600 hover:underline text-sm">← Back to timeline</Link>

      <h1 style={{ margin: '12px 0' }}>Ripple</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Total posts: <strong>{posts.length}</strong> · People: <strong>{uniqueAuthors}</strong> · Depth: <strong>{maxDepth}</strong>
      </p>
      {root && (
        <p style={{ marginTop: 4 }}>
          Root post: <Link className="text-blue-600 hover:underline" to={`/post/${root.id}`}>open</Link>
        </p>
      )}

      {gens.map((g) => (
        <section key={g} style={{ margin: '16px 0 24px' }}>
          <h3 style={{ margin: '8px 0 12px' }}>Wave {g}</h3>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {byGen[g].map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  textDecoration: 'none',
                  color: '#111827',
                  background: '#fff'
                }}
              >
                <Link to={`/post/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {p.photoURL ? (
                      <img src={p.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb' }} />
                    )}
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.displayName || 'Anonymous'}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.35, color: '#374151' }}>
                    “{p.text}”
                  </div>
                </Link>

                {/* Pass-it-on CTA */}
                <div>
                  <button
                    onClick={() => {
                      const nextGen = (p.generation ?? 0) + 1;
                      navigate(`/?rippleId=${p.rippleId}&parent=${p.id}&gen=${nextGen}`);
                    }}
                    className="postcomment-button"
                    style={{ padding: '6px 10px', borderRadius: 8 }}
                  >
                    Pass it on
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
