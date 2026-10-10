import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';

type AuthStatus = 'checking' | 'loggedIn' | 'loggedOut';

export const RequireAuth = () => {
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => setStatus(res.ok ? 'loggedIn' : 'loggedOut'))
      .catch(() => setStatus('loggedOut'));
  }, []);

  if (status === 'checking') return <p>Loading...</p>;
  if (status === 'loggedOut') return <Navigate to="/login" replace />;
  return <Outlet />;
};
