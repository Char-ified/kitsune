// Works out a pet's mood from its repo's events. Mood is calculated, never stored.
import type { EventType, Mood } from '@kitsune/shared';

export type MoodEvent = { type: EventType; createdAt: Date };

export const HAPPY_WINDOW_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// A pure function: the answer depends only on the events and the time passed in,
// so the 3-day rule can be tested without waiting.
export const getMood = (events: MoodEvent[], now: Date): Mood => {
  // Rule 1: no events yet
  if (events.length === 0) return 'normal';

  // Rule 2: the most recent test run failed. One failure is enough, and only a
  // passing run cures it: a merged pull request on top of broken tests isn't a fix.
  const newestFirst = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestTestRun = newestFirst.find((event) => event.type !== 'pr_merged');
  if (latestTestRun?.type === 'tests_failed') return 'sick';

  // Rule 3: good news (a merged pull request or passing tests) in the last few days
  const windowStart = now.getTime() - HAPPY_WINDOW_DAYS * DAY_MS;
  const hadRecentGoodNews = events.some(
    (event) => event.type !== 'tests_failed' && event.createdAt.getTime() >= windowStart,
  );
  if (hadRecentGoodNews) return 'happy';

  // Rule 4: the repo has been quiet
  return 'normal';
};
