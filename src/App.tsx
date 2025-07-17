import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import PostPage from './pages/PostPage'; 
import RequireAuth from './components/RequireAuth';
import TimelinePage from './pages/TimelinePage';
import PostDetailPage from './pages/PostDetailPage';

function App() {
  return (
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
      <Route path="/post/:id" element={
        <PostDetailPage />
        } 
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
