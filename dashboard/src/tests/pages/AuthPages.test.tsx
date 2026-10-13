import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authApi } from '../../api';
import { AuthProvider } from '../../auth/AuthContext';
import { RequireAuth } from '../../components/RequireAuth';
import { LoginPage } from '../../pages/LoginPage';
import { SignupPage } from '../../pages/SignupPage';

// Keep the real ApiError, but replace the login calls with fakes.
vi.mock('../../api', async () => {
  const { ApiError } = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ApiError,
    authApi: { me: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() },
  };
});

const fox = { id: 1, email: 'fox@example.com' };

// The real app in miniature: the login state provider, the two public pages,
// and one protected page behind the guard.
const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>Dashboard page</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );

const fillIn = async (email: string, password: string) => {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText(/^Password/), password);
};

beforeEach(() => {
  vi.mocked(authApi.login).mockReset();
  vi.mocked(authApi.signup).mockReset();
  // By default nobody is logged in: the "who am I?" call answers 401.
  vi.mocked(authApi.me).mockReset().mockRejectedValue(new ApiError(401, 'Not logged in'));
});

describe('the login guard', () => {
  it('sends a logged-out visitor to the login page', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });

  it('lets a logged-in user through', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ user: fox });
    renderApp('/');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows nothing protected while it is still checking', () => {
    // A "who am I?" call that never answers.
    vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}));
    renderApp('/');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });

  it('sends someone who is already logged in away from the login page', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ user: fox });
    renderApp('/login');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });
});

describe('LoginPage', () => {
  it('logs in and goes to the dashboard', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ user: fox });
    renderApp('/login');

    await fillIn('fox@example.com', 'hunter2!!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(authApi.login).toHaveBeenCalledWith('fox@example.com', 'hunter2!!');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it("shows the server's message for a wrong password, and stays on the page", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderApp('/login');

    await fillIn('fox@example.com', 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });

  it('says so when the server cannot be reached', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/login');

    await fillIn('fox@example.com', 'hunter2!!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Could not reach the server. Try again.')).toBeInTheDocument();
  });
});

describe('SignupPage', () => {
  it('creates the account, which also logs in, and goes to the dashboard', async () => {
    vi.mocked(authApi.signup).mockResolvedValue({ user: fox });
    renderApp('/signup');

    await fillIn('fox@example.com', 'hunter2!!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(authApi.signup).toHaveBeenCalledWith('fox@example.com', 'hunter2!!');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it("shows the server's message when the email is already registered", async () => {
    vi.mocked(authApi.signup).mockRejectedValue(new ApiError(409, 'Email already registered'));
    renderApp('/signup');

    await fillIn('fox@example.com', 'hunter2!!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });
});
