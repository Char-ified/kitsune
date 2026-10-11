// Decides when the fox gets up for a walk. It sits most of the time, so that
// when it does move, it's worth a glance. No Chrome or DOM code, so it can be unit tested.
import type { Mood } from '@kitsune/shared';

// How long the fox rests between walks. A happy fox is livelier. A sick fox stays put.
export const REST_MS: Record<Mood, number | null> = {
  happy: 60_000,
  normal: 150_000,
  sick: null,
};

// `lastStrollAt` is when the last walk started (a timestamp), or null if it never has.
export const shouldStroll = (mood: Mood, lastStrollAt: number | null, now: number): boolean => {
  const rest = REST_MS[mood];
  if (rest === null) return false;
  return lastStrollAt === null || now - lastStrollAt >= rest;
};
