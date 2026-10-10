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
  } catch (err) {
    console.warn(err);
    return null;
  }
};
