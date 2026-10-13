// Turns raw events into what people actually read: one short line each, quiet about
// routine good news. Used by the dashboard's event log and the extension's fox,
// so both always say the same thing.
import type { RepoEvent } from './index.js';

export type EventLine = { text: string; url?: string };

// The link comes from GitHub's payload. Only ever link to GitHub itself.
const safeUrl = (url: string | undefined): string | undefined =>
  url?.startsWith('https://github.com/') ? url : undefined;

// One short line for an event, e.g. "PR #12 merged!" or "Tests failed on #14".
export const describeEvent = (event: RepoEvent): EventLine => {
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

// Is this event worth interrupting someone for? `events` must be newest first.
// Merges and failures always are. A passing test run only is when it follows a failure,
// because "the tests are fixed" is news and "the tests still pass" is not.
export const isNews = (event: RepoEvent, events: RepoEvent[]): boolean => {
  if (event.type !== 'tests_passed') return true;

  const olderTestRun = events
    .slice(events.indexOf(event) + 1)
    .find((other) => other.type !== 'pr_merged');
  return olderTestRun?.type === 'tests_failed';
};

// A row in an event log: one event, or several passing test runs in a row folded into one.
export type EventGroup = { latest: RepoEvent; count: number };

// Folds each run of back-to-back passing test runs into a single row, so the log reads
// "Tests passed ×4" once instead of four identical lines. `events` must be newest first.
export const groupEvents = (events: RepoEvent[]): EventGroup[] => {
  const groups: EventGroup[] = [];

  for (const event of events) {
    const last = groups.at(-1);
    if (last && event.type === 'tests_passed' && last.latest.type === 'tests_passed') {
      last.count += 1;
    } else {
      groups.push({ latest: event, count: 1 });
    }
  }

  return groups;
};

// The line for a row in the log: "Tests passed ×4" for a folded row, otherwise the event's own line.
export const describeGroup = (group: EventGroup): EventLine =>
  group.count > 1
    ? { text: `Tests passed ×${group.count}`, url: describeEvent(group.latest).url }
    : describeEvent(group.latest);

// "Today 7:51 PM", "Yesterday 5:52 PM", or "Oct 10, 4:38 PM".
export const formatWhen = (date: Date, now: Date): string => {
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
};
