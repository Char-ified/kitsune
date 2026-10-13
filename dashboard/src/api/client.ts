import type {
  Character,
  ConnectedRepo,
  Pet,
  Repo,
  RepoEvent,
  User,
  WebhookDetails,
} from '@kitsune/shared';

// Thrown for any non-2xx response, so pages can show `error.message`
// and check `error.status` (e.g. 404 means "no pet yet").
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// One place for every request: sends JSON, reads JSON, and turns the
// server's `{ "error": "..." }` responses into an ApiError.
const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Something went wrong. Try again.');
  }

  return data as T;
};

// The login routes (docs/API.md routes 1 to 4). These always talk to the real server,
// even when the rest of the dashboard is running on the fake API. The login cookie is
// httpOnly, so it is set and cleared by the server and never touched here.
export const authApi = {
  signup: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ loggedOut: true }>('/api/auth/logout', { method: 'POST' }),

  // Who is logged in? Throws an ApiError with status 401 when nobody is.
  me: () => request<{ user: User }>('/api/auth/me'),
};

type PetInput = { name: string; character: Character };

// Every server route the dashboard uses, in the same order as docs/API.md.
export const realApi = {
  getRepos: () => request<Repo[]>('/api/repos'),

  connectRepo: (fullName: string) =>
    request<ConnectedRepo>('/api/repos', { method: 'POST', body: JSON.stringify({ fullName }) }),

  disconnectRepo: (repoId: number) =>
    request<{ deleted: true }>(`/api/repos/${repoId}`, { method: 'DELETE' }),

  newWebhookSecret: (repoId: number) =>
    request<WebhookDetails>(`/api/repos/${repoId}/webhook-secret`, { method: 'POST' }),

  getPet: (repoId: number) => request<Pet>(`/api/repos/${repoId}/pet`),

  createPet: (repoId: number, input: PetInput) =>
    request<Pet>(`/api/repos/${repoId}/pet`, { method: 'POST', body: JSON.stringify(input) }),

  updatePet: (repoId: number, input: Partial<PetInput>) =>
    request<Pet>(`/api/repos/${repoId}/pet`, { method: 'PATCH', body: JSON.stringify(input) }),

  getEvents: (repoId: number) => request<RepoEvent[]>(`/api/repos/${repoId}/events`),
};

// The fake API in mocks.ts must match this shape exactly.
export type Api = typeof realApi;
