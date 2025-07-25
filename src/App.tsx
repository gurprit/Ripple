import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import PostPage from './pages/PostPage'; 
import RequireAuth from './components/RequireAuth';
import TimelinePage from './pages/TimelinePage';
import PostDetailPage from './pages/PostDetailPage';


function RainbowBackground() {
  const [width, setWidth] = useState('0%');
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWidth('100%');
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWidth('100%');
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={divRef}
      className='rainbow-bkgrd'
      style={{ width }}
    />
  );
}

function App() {
  const location = useLocation();

  return (
    <>
      <RainbowBackground key={location.pathname} />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <TimelinePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/post"
          element={
            <RequireAuth>
              <PostPage />
            </RequireAuth>
          }
        />
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default App;
