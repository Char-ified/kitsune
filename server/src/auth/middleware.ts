import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './token.js';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authorization: string | undefined = req.headers.authorization;
  let token: string | undefined = req.cookies?.token;
  if (!token && authorization?.startsWith('Bearer ')) {
    token = authorization.slice(7);
  }

  if (!token) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  const userId = verifyToken(token);

  if (userId === null) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  res.locals.userId = userId;
  next();
};
