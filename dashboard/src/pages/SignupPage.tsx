import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth, type User } from '../auth/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { TextInput } from '../components/TextInput';
import '../styles/AuthPages.css';

export const SignupPage = () => {
  const { status, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loggedIn') return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Difference 1: the signup route
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: { user?: User; error?: string } = await res.json();

      if (!res.ok || !data.user) {
        setError(data.error ?? 'Something went wrong. Try again.');
        return;
      }

      // Signing up also logs you in (see docs/API.md, route 1).
      setUser(data.user);
      navigate('/');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell scene="crescent">
      <Panel title="Sign up">
        <p className="auth-subtitle">Create an account to meet your guardian.</p>
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {/* Difference 2: the label states the rule, and autoComplete says "new password" */}
          <TextInput
            label="Password (at least 8 characters)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error || undefined}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        {/* Difference 3: the link goes the other way */}
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Panel>
    </AuthShell>
  );
};
