import express from 'express';
import type { Request, Response } from 'express';
import pool from '../db.js';
import { hashPassword } from './password.js';
import { createToken } from './token.js';
import { verifyPassword } from './password.js';
import { requireAuth } from './middleware.js';

const authRouter = express.Router();

const COOKIE_NAME = 'token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Settings for the login cookie (see docs/AI.md, "Cookie Settings").
const cookieOptions = {
  httpOnly: true, // page scripts cant read it
  secure: process.env.NODE_ENV === 'production', // HTTPS only once deployed
  sameSite: 'lax' as const,
  maxAge: SEVEN_DAYS_MS, // Matches the tokens 7-day expiry
};

authRouter.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );
    const user = result.rows[0];

    const token = createToken(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.status(201).json({ token, user });
  } catch (err) {
    // 23505 is Postgres's code for "unique violation": this email is already in the table
    if (err instanceof Error && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    throw err;
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
    email,
  ]);
  const row = result.rows[0];

  // Same message whether the eamil or the password is wrong, so nobody can
  // find out which emails have accounts (user enumeration)
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const user = { id: row.id, email: row.email };
  const token = createToken(user.id);
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.status(200).json({ token, user });
});

// Public on purpose: logging out twice is harmless so this always succeeds
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });
  res.json({ loggedOut: true });
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [res.locals.userId]);
  const user = result.rows[0];

  // The token was valid but the account no longer exsists
  if (!user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  res.json({ user });
});

export default authRouter;
