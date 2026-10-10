import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth, type User } from '../auth/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { TextInput } from '../components/TextInput';
import '../styles/AuthPages.css';

export const LoginPage = () => {
  const { status, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? No reason to be on this page.
  if (status === 'loggedIn') return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: { user?: User; error?: string } = await res.json();

      if (!res.ok || !data.user) {
        setError(data.error ?? 'Something went wrong. Try again.');
        return;
      }

      setUser(data.user);
      navigate('/');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell scene="full">
      <Panel title="Log in">
        <p className="auth-subtitle">Your guardian is waiting for you.</p>
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextInput
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error || undefined}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/signup">Sign up</Link>
        </p>
      </Panel>
    </AuthShell>
  );
};
