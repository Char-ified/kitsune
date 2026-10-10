// GitHub signs every webhook delivery with the repo's secret (HMAC SHA-256) and sends
// the result in the X-Hub-Signature-256 header as "sha256=<hex>". We compute the same
// thing ourselves; only someone who knows the secret can produce a matching value.
import crypto from 'node:crypto';

export const signPayload = (rawBody: Buffer, secret: string): string =>
  `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

export const isValidSignature = (
  rawBody: Buffer,
  secret: string,
  signature: string | undefined,
): boolean => {
  if (!signature) return false;

  const expected = Buffer.from(signPayload(rawBody, secret));
  const received = Buffer.from(signature);

  // timingSafeEqual takes the same time whether the first or the last character differs,
  // so an attacker can't guess the signature one character at a time by timing replies.
  // It throws if the lengths differ, so that is checked first.
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};
