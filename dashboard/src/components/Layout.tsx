import { Link, Outlet, useNavigate } from 'react-router';
import { authApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import '../styles/Layout.css';

export const Layout = () => {
  const { status, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Even if the server can't be reached, show the user as logged out here.
    await authApi.logout().catch(() => undefined);
    setUser(null);
    navigate('/login');
  };

  return (
    <>
      <header>
        <Link className="header-brand" to="/">
          <img className="header-logo" src="/kitsune-happy.png" alt="" />
          <span className="header-title">Kitsune Repo Pet</span>
        </Link>
        {status === 'loggedIn' && (
          <nav className="header-nav">
            <Link to="/">My repos</Link>
            <Button variant="secondary" onClick={handleLogout}>
              Log out
            </Button>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
};
