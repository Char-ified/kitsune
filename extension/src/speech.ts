// What the fox says about an event, and which event (if any) it should speak up about.
// No Chrome or DOM code in here, so it can be unit tested.
import type { RepoEvent } from '@kitsune/shared';

export type Line = { text: string; url?: string };

// News older than this isn't worth interrupting anyone for.
export const FRESH_MS = 24 * 60 * 60 * 1000;

// The link comes from GitHub's payload. Only ever link to GitHub itself.
const safeUrl = (url: string | undefined): string | undefined =>
  url?.startsWith('https://github.com/') ? url : undefined;

// One short line for an event, e.g. "PR #12 merged!" or "Tests failed on #14".
export const describeEvent = (event: RepoEvent): Line => {
  const { number } = event.details;
  const url = safeUrl(event.details.url);

  switch (event.type) {
    case 'pr_merged':
      return { text: number ? `PR #${number} merged!` : 'A pull request merged!', url };
    case 'tests_passed':
      return { text: number ? `Tests passed on #${number}` : 'Tests passed', url };
    case 'tests_failed':
      return { text: number ? `Tests failed on #${number}` : 'Tests failed', url };
  }
};

// Picks the event the fox should announce: the newest one the user hasn't seen yet,
// as long as it's recent. `lastSeenId` is the newest event already shown, or null.
// Event IDs only ever go up, so "newer" is simply "a bigger ID".
export const eventToAnnounce = (
  events: RepoEvent[],
  lastSeenId: number | null,
  now: number,
): RepoEvent | null => {
  const newest = events.reduce<RepoEvent | null>(
    (best, event) => (best === null || event.id > best.id ? event : best),
    null,
  );
  if (!newest) return null;

  const alreadySeen = lastSeenId !== null && newest.id <= lastSeenId;
  const fresh = now - new Date(newest.createdAt).getTime() <= FRESH_MS;
  return !alreadySeen && fresh ? newest : null;
};
