// The messages the popup and the content script can send to the background worker.
// Sharing these types means TypeScript catches a misspelled message on either side.
import type { Mood, User } from '@kitsune/shared';

export type ExtensionRequest =
  | { type: 'getSession' }
  | { type: 'login'; email: string; password: string }
  | { type: 'logout' }
  | { type: 'getPet'; fullName: string };

// Answer to getSession, login, and logout: who is logged in (or null), and an error to show.
export type SessionResponse = { user: User | null; error?: string };

// Answer to getPet: what the widget should show for one GitHub repo.
export type PetResponse =
  | { state: 'loggedOut' }
  // The user hasn't connected this repo, so there is nothing to show.
  | { state: 'notConnected' }
  | { state: 'noPet'; repoId: number }
  | { state: 'pet'; repoId: number; name: string; mood: Mood }
  // The server couldn't be reached. The widget keeps showing what it had.
  | { state: 'error' };
