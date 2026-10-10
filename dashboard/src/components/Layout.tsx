import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import '../styles/Layout.css';

export const Layout = () => {
  const { status, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  return (
    <>
      <header>
        <span className="header-title">Kitsune Repo Pet</span>
        {status === 'loggedIn' && (
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
};
