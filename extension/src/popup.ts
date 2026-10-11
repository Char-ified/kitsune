// Popup script: runs each time the extension icon is clicked. (CHA-13)
// It only draws the screen. All server calls go through the background worker.
import { DASHBOARD_URL } from './config';
import type { ExtensionRequest, SessionResponse } from './messages';

// The popup only sends session messages (never getPet), so the answer is always a SessionResponse.
type SessionRequest = Exclude<ExtensionRequest, { type: 'getPet' }>;

const send = (request: SessionRequest): Promise<SessionResponse> =>
  chrome.runtime.sendMessage(request);

// Finds an element by id, and fails loudly if popup.html and this file get out of sync.
const find = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`popup.html is missing #${id}`);
  return element as T;
};

const loadingView = find('loading');
const loggedOutView = find('logged-out');
const loggedInView = find('logged-in');
const loginForm = find<HTMLFormElement>('login-form');
const emailInput = find<HTMLInputElement>('email');
const passwordInput = find<HTMLInputElement>('password');
const loginButton = find<HTMLButtonElement>('login-button');
const errorText = find('error');
const userEmail = find('user-email');

// Shows the right screen for a session: the login form, or the logged-in view.
const show = (session: SessionResponse) => {
  loadingView.hidden = true;
  loggedOutView.hidden = session.user !== null;
  loggedInView.hidden = session.user === null;

  errorText.textContent = session.error ?? '';
  errorText.hidden = !session.error;

  if (session.user) userEmail.textContent = session.user.email;
};

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = 'Logging in...';

  const session = await send({
    type: 'login',
    email: emailInput.value,
    password: passwordInput.value,
  });

  loginButton.disabled = false;
  loginButton.textContent = 'Log in →';
  passwordInput.value = '';
  show(session);
});

find('logout-button').addEventListener('click', async () => {
  show(await send({ type: 'logout' }));
});

find('open-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

find<HTMLAnchorElement>('signup-link').href = `${DASHBOARD_URL}/signup`;

// On open: ask the background worker whether someone is already logged in.
send({ type: 'getSession' }).then(show);
