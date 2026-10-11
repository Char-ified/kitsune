import { describe, expect, it } from 'vitest';
import { REST_MS, shouldStroll } from '../stroll';

const NOW = 1_000_000_000;

describe('shouldStroll', () => {
  it('walks when it has never walked before', () => {
    expect(shouldStroll('happy', null, NOW)).toBe(true);
  });

  it('keeps resting until the rest time is up', () => {
    expect(shouldStroll('normal', NOW - 10_000, NOW)).toBe(false);
  });

  it('walks again once it has rested long enough', () => {
    expect(shouldStroll('normal', NOW - 150_000, NOW)).toBe(true);
  });

  it('gets up sooner when happy than when normal', () => {
    const lastStroll = NOW - 90_000;

    expect(shouldStroll('happy', lastStroll, NOW)).toBe(true);
    expect(shouldStroll('normal', lastStroll, NOW)).toBe(false);
  });

  it('never walks when sick', () => {
    expect(REST_MS.sick).toBeNull();
    expect(shouldStroll('sick', null, NOW)).toBe(false);
  });
});
