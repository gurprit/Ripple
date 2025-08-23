import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import PostPage from './pages/PostPage'; 
import RequireAuth from './components/RequireAuth';
import TimelinePage from './pages/TimelinePage';
import PostDetailPage from './pages/PostDetailPage';
import RipplePage from './pages/RipplePage';


function App() {

  return (
    <>

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
        <Route path="/ripple/:rippleId" element={<RipplePage />} />
      </Routes>
    </>
  );
}

export default App;
