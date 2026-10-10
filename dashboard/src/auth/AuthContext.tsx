import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type User = { id: number; email: string };
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
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user: User } | null) => {
        setUserState(data ? data.user : null);
        setStatus(data ? 'loggedIn' : 'loggedOut');
      })
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
