import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@kitsune/shared';
import { authApi } from '../api';

type AuthStatus = 'checking' | 'loggedIn' | 'loggedOut';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Holds "who is logged in" for the whole app. Asks the server once on load,
// because the login cookie is httpOnly and page scripts can't read it.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => {
        setUserState(user);
        setStatus('loggedIn');
      })
      // A 401 (nobody is logged in) and an unreachable server both mean "logged out".
      .catch(() => setStatus('loggedOut'));
  }, []);

  // Pages call this after logging in (with the user) or logging out (with null)
  const setUser = (next: User | null) => {
    setUserState(next);
    setStatus(next ? 'loggedIn' : 'loggedOut');
  };

  return <AuthContext.Provider value={{ status, user, setUser }}>{children}</AuthContext.Provider>;
};

// The hook components user to read or update the logged-in user
export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
};
