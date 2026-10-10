// Background service worker: the only part of the extension that talks to our server. (CHA-13)
// The popup sends it a message, it does the work, and it sends back the result.
// Chrome starts and stops this script whenever it likes, so nothing is kept in variables:
// the token lives in chrome.storage.
import type { User } from '@kitsune/shared';
import { SERVER_URL } from './config';
import type { ExtensionRequest, SessionResponse } from './messages';

const TOKEN_KEY = 'token';

const getToken = async (): Promise<string | null> => {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const token: unknown = stored[TOKEN_KEY];
  return typeof token === 'string' ? token : null;
};

const login = async (email: string, password: string): Promise<SessionResponse> => {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The extension uses the token from the response body, not the cookie.
    credentials: 'omit',
    body: JSON.stringify({ email, password }),
  });
  const data: { token?: string; user?: User; error?: string } = await res.json();

  if (!res.ok || !data.token || !data.user) {
    return { user: null, error: data.error ?? 'Something went wrong. Try again.' };
  }

  await chrome.storage.local.set({ [TOKEN_KEY]: data.token });
  return { user: data.user };
};

// Asks the server who this token belongs to. A token can be saved but no longer valid
// (it expires after 7 days), so the stored token alone doesn't prove anyone is logged in.
const getSession = async (): Promise<SessionResponse> => {
  const token = await getToken();
  if (!token) return { user: null };

  const res = await fetch(`${SERVER_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });

  if (res.status === 401) {
    await chrome.storage.local.remove(TOKEN_KEY);
    return { user: null };
  }
  if (!res.ok) return { user: null, error: 'Something went wrong. Try again.' };

  const data: { user: User } = await res.json();
  return { user: data.user };
};

const logout = async (): Promise<SessionResponse> => {
  await chrome.storage.local.remove(TOKEN_KEY);
  return { user: null };
};

const handle = (request: ExtensionRequest): Promise<SessionResponse> => {
  switch (request.type) {
    case 'login':
      return login(request.email, request.password);
    case 'logout':
      return logout();
    case 'getSession':
      return getSession();
  }
};

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  handle(request)
    .then(sendResponse)
    // fetch throws when the server can't be reached at all.
    .catch(() => sendResponse({ user: null, error: 'Could not reach the server. Is it running?' }));

  // Returning true tells Chrome the answer is coming later, so it keeps the line open.
  return true;
});
