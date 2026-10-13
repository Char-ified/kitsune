import { describe, expect, it } from 'vitest';
import type { RepoEvent } from '@kitsune/shared';
import { describeEvent, eventToAnnounce } from '../speech';

const NOW = new Date('2026-10-11T12:00:00.000Z').getTime();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const event = (overrides: Partial<RepoEvent>): RepoEvent => ({
  id: 1,
  type: 'pr_merged',
  details: {},
  createdAt: minutesAgo(1),
  ...overrides,
});

describe('describeEvent', () => {
  it('names the pull request that merged, with a link', () => {
    const line = describeEvent(
      event({ details: { number: 12, url: 'https://github.com/a/b/pull/12' } }),
    );

    expect(line).toEqual({ text: 'PR #12 merged!', url: 'https://github.com/a/b/pull/12' });
  });

  it('says which pull request the tests ran on, when there is one', () => {
    expect(describeEvent(event({ type: 'tests_failed', details: { number: 14 } })).text).toBe(
      'Tests failed on #14',
    );
    expect(describeEvent(event({ type: 'tests_passed', details: { name: 'CI' } })).text).toBe(
      'Tests passed',
    );
  });

  it('still makes sense when GitHub sent no details', () => {
    expect(describeEvent(event({ details: {} }))).toEqual({
      text: 'A pull request merged!',
      url: undefined,
    });
  });

  it('never links anywhere except GitHub', () => {
    const line = describeEvent(event({ details: { number: 1, url: 'https://evil.example/x' } }));

    expect(line.url).toBeUndefined();
  });
});

describe('eventToAnnounce', () => {
  it('announces a new event', () => {
    const latest = event({ id: 5 });

    expect(eventToAnnounce([latest, event({ id: 4 })], 4, NOW)).toBe(latest);
  });

  it('picks the newest event whatever order the list is in', () => {
    const latest = event({ id: 9 });

    expect(eventToAnnounce([event({ id: 7 }), latest, event({ id: 8 })], null, NOW)).toBe(latest);
  });

  it('stays quiet about an event the user has already seen', () => {
    expect(eventToAnnounce([event({ id: 5 })], 5, NOW)).toBeNull();
  });

  it('announces the latest event the first time, if it is recent', () => {
    expect(eventToAnnounce([event({ id: 5 })], null, NOW)).not.toBeNull();
  });

  it('stays quiet about old news', () => {
    const old = event({ id: 5, createdAt: minutesAgo(60 * 25) });

    expect(eventToAnnounce([old], null, NOW)).toBeNull();
  });

  it('stays quiet when there are no events', () => {
    expect(eventToAnnounce([], null, NOW)).toBeNull();
  });
});
