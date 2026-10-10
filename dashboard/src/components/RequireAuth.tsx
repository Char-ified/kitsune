import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export const RequireAuth = () => {
  const { status } = useAuth();

  if (status === 'checking') return <p>Loading...</p>;
  if (status === 'loggedOut') return <Navigate to="/login" replace />;
  return <Outlet />;
};
