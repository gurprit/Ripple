import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';

export default function NavBar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <nav className="main-nav w-full bg-blue-600 text-white flex justify-around py-3 fixed top-0 left-0">
      <Link to="/" className="hover:underline">Timeline</Link> 
      <Link to="/profile" className="hover:underline">Profile</Link> 
      <button onClick={handleLogout} className="hover:underline">Logout</button>
    </nav>
  );
}
