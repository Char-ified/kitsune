// Which event (if any) the fox should speak up about, and what it says.
// No Chrome or DOM code in here, so it can be unit tested.
import { describeEvent, isNews, type EventLine, type RepoEvent } from '@kitsune/shared';

// News older than this isn't worth interrupting anyone for.
export const FRESH_MS = 24 * 60 * 60 * 1000;

// Picks the event the fox should announce: the newest one that is real news (see isNews),
// that the user hasn't seen yet, and that is recent. `events` must be newest first.
// `lastSeenId` is the newest event already shown, or null. Event IDs only ever go up,
// so "not seen yet" is simply "a bigger ID".
export const eventToAnnounce = (
  events: RepoEvent[],
  lastSeenId: number | null,
  now: number,
): RepoEvent | null =>
  events.find(
    (event) =>
      (lastSeenId === null || event.id > lastSeenId) &&
      now - new Date(event.createdAt).getTime() <= FRESH_MS &&
      isNews(event, events),
  ) ?? null;

// What the fox says. A passing run is only ever announced after a failure,
// so it gets its own wording: the point is that the tests are fixed.
export const announcement = (event: RepoEvent): EventLine => {
  const line = describeEvent(event);
  if (event.type !== 'tests_passed') return line;

  const { number } = event.details;
  return {
    text: number ? `Tests are passing again on #${number}` : 'Tests are passing again',
    url: line.url,
  };
};
