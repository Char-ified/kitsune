import jwt from 'jsonwebtoken';

const getSecret = (): string => {
  const secret: string | undefined = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to server/.env');
  }
  return secret;
};

export const createToken = (userId: number): string => {
  const payload = { userId };
  const secret = getSecret();
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const verifyToken = (token: string): number | null => {
  const secret = getSecret();
  try {
    const payload = jwt.verify(token, secret) as { userId: number };
    return payload.userId;
  } catch {
    // An expired or made-up token is an everyday event (a stale cookie), not a problem worth
    // a stack trace in the logs. The caller answers 401, and the request log records it.
    return null;
  }
};
