import { describe, expect, it } from 'vitest';
import type { EventType, RepoEvent } from '@kitsune/shared';
import { announcement, eventToAnnounce } from '../speech';

const NOW = new Date('2026-10-12T12:00:00.000Z').getTime();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

// Builds a list, newest first, from a row of types: the first one gets the biggest ID.
const list = (...types: EventType[]): RepoEvent[] =>
  types.map((type, index) => ({
    id: types.length - index,
    type,
    details: {},
    createdAt: minutesAgo(index + 1),
  }));

describe('eventToAnnounce', () => {
  it('announces a merged pull request', () => {
    const events = list('pr_merged', 'tests_passed');

    expect(eventToAnnounce(events, null, NOW)).toBe(events[0]);
  });

  it('announces a failed test run', () => {
    const events = list('tests_failed', 'tests_passed');

    expect(eventToAnnounce(events, null, NOW)).toBe(events[0]);
  });

  it('stays quiet when the tests simply pass again', () => {
    expect(eventToAnnounce(list('tests_passed', 'tests_passed'), null, NOW)).toBeNull();
  });

  it('announces tests passing after a failure', () => {
    const events = list('tests_passed', 'tests_failed');

    expect(eventToAnnounce(events, 1, NOW)).toBe(events[0]);
  });

  it('looks past routine passes to the news underneath', () => {
    const events = list('tests_passed', 'pr_merged', 'tests_passed');

    expect(eventToAnnounce(events, null, NOW)).toBe(events[1]);
  });

  it('stays quiet about an event the user has already seen', () => {
    expect(eventToAnnounce(list('pr_merged'), 1, NOW)).toBeNull();
  });

  it('stays quiet about old news', () => {
    const [old] = list('pr_merged');

    expect(eventToAnnounce([{ ...old, createdAt: minutesAgo(60 * 25) }], null, NOW)).toBeNull();
  });

  it('stays quiet when there are no events', () => {
    expect(eventToAnnounce([], null, NOW)).toBeNull();
  });
});

describe('announcement', () => {
  it('says the tests are passing again, since a pass is only announced after a failure', () => {
    const [passed] = list('tests_passed');

    expect(announcement({ ...passed, details: { number: 14 } }).text).toBe(
      'Tests are passing again on #14',
    );
    expect(announcement(passed).text).toBe('Tests are passing again');
  });

  it('uses the normal line for everything else', () => {
    const [merged] = list('pr_merged');

    expect(announcement({ ...merged, details: { number: 12 } }).text).toBe('PR #12 merged!');
  });
});
