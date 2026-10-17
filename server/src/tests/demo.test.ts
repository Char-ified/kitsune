import { expect, it } from 'vitest';

// Fails on purpose, to show the fox reacting. This branch is never merged.
it('breaks on purpose, to make the fox sick', () => {
  expect('happy').toBe('sick');
});
