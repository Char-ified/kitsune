import { describe, expect, it } from 'vitest';
import {
  describeGroup,
  formatWhen,
  groupEvents,
  isNews,
  type EventType,
  type RepoEvent,
} from '@kitsune/shared';

// Builds a list, newest first, from a row of types: the first one gets the biggest ID.
const list = (...types: EventType[]): RepoEvent[] =>
  types.map((type, index) => ({
    id: types.length - index,
    type,
    details: {},
    createdAt: '2026-10-12T12:00:00.000Z',
  }));

describe('groupEvents', () => {
  it('folds passing test runs that are back to back into one row', () => {
    const groups = groupEvents(list('tests_passed', 'tests_passed', 'tests_passed', 'pr_merged'));

    expect(groups.map((group) => [group.latest.type, group.count])).toEqual([
      ['tests_passed', 3],
      ['pr_merged', 1],
    ]);
  });

  it('keeps the newest run as the face of a folded row', () => {
    const events = list('tests_passed', 'tests_passed');

    expect(groupEvents(events)[0].latest).toBe(events[0]);
  });

  it('never folds merges or failures, even when they repeat', () => {
    const groups = groupEvents(list('pr_merged', 'pr_merged', 'tests_failed', 'tests_failed'));

    expect(groups).toHaveLength(4);
  });

  it('starts a new row when something else happens in between', () => {
    const groups = groupEvents(list('tests_passed', 'pr_merged', 'tests_passed'));

    expect(groups.map((group) => group.count)).toEqual([1, 1, 1]);
  });
});

describe('describeGroup', () => {
  it('shows how many runs a folded row stands for', () => {
    const [group] = groupEvents(list('tests_passed', 'tests_passed'));

    expect(describeGroup(group).text).toBe('Tests passed ×2');
  });
});

describe('isNews', () => {
  it('always counts a merge or a failure as news', () => {
    const events = list('pr_merged', 'tests_failed', 'tests_passed');

    expect(isNews(events[0], events)).toBe(true);
    expect(isNews(events[1], events)).toBe(true);
  });

  it('does not count tests passing again and again as news', () => {
    const events = list('tests_passed', 'tests_passed');

    expect(isNews(events[0], events)).toBe(false);
  });

  it('counts tests passing right after a failure as news', () => {
    const events = list('tests_passed', 'pr_merged', 'tests_failed');

    expect(isNews(events[0], events)).toBe(true);
  });

  it('does not count the very first passing run as news', () => {
    const events = list('tests_passed');

    expect(isNews(events[0], events)).toBe(false);
  });
});

describe('formatWhen', () => {
  const now = new Date(2026, 9, 12, 20, 0);

  it('says Today, Yesterday, or the date', () => {
    expect(formatWhen(new Date(2026, 9, 12, 9, 5), now)).toMatch(/^Today /);
    expect(formatWhen(new Date(2026, 9, 11, 23, 59), now)).toMatch(/^Yesterday /);
    expect(formatWhen(new Date(2026, 9, 3, 12, 0), now)).toMatch(/^Oct 3, /);
  });
});
