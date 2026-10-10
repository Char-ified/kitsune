// The messages the popup (and later the script) can send to the background worker
// Sharing these types means Typescript catches a misspelled message on either side
import type { User } from '@kitsune/shared';

export type ExtensionRequest =
  { type: 'getSession' } | { type: 'login'; email: string; password: string } | { type: 'logout' };

// Every request gets this back: who is logged in (or null) and an error to show if one happened
export type SessionResponse = { user: User | null; error?: string };
