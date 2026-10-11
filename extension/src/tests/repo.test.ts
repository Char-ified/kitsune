import { describe, expect, it } from 'vitest';
import type { Repo } from '@kitsune/shared';
import { findRepo, repoFromPath } from '../repo';

describe('repoFromPath', () => {
  it.each([
    ['/Char-ified/kitsune', 'Char-ified/kitsune'],
    ['/Char-ified/kitsune/', 'Char-ified/kitsune'],
    ['/Char-ified/kitsune/pull/12', 'Char-ified/kitsune'],
    ['/Char-ified/kitsune/blob/main/README.md', 'Char-ified/kitsune'],
  ])('reads %s as %s', (path, expected) => {
    expect(repoFromPath(path)).toBe(expected);
  });

  it.each([
    ['the home page', '/'],
    ['a profile page', '/Char-ified'],
    ['settings', '/settings/profile'],
    ['notifications', '/notifications/subscriptions'],
    ['an organization page', '/orgs/Char-ified/repositories'],
  ])('returns null for %s', (_label, path) => {
    expect(repoFromPath(path)).toBeNull();
  });
});

describe('findRepo', () => {
  const repo: Repo = {
    id: 1,
    fullName: 'Char-ified/kitsune',
    hasPet: false,
    pet: null,
    createdAt: '2026-10-10T00:00:00.000Z',
  };

  it('finds a repo by its full name', () => {
    expect(findRepo([repo], 'Char-ified/kitsune')).toBe(repo);
  });

  it('ignores capital letters, like GitHub does', () => {
    expect(findRepo([repo], 'char-ified/KITSUNE')).toBe(repo);
  });

  it('remember undefined when the repo is not connected', () => {
    expect(findRepo([repo], 'someone/else')).toBeUndefined();
  });
});
