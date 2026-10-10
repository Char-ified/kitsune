import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import crypto from 'node:crypto';

const reposRouter = express.Router();

reposRouter.get('/', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, full_name, created_at FROM repos WHERE user_id = $1',
    [res.locals.userId],
  );

  res.json(result.rows);
});

reposRouter.post('/', requireAuth, async (req, res) => {
  const fullName: unknown = req.body?.fullName;

  if (typeof fullName !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    res.status(400).json({ error: 'fullName must be in the form owner/repo-name' });
    return;
  }

  const webhookSecret = crypto.randomBytes(32).toString('hex');

  try {
    const result = await pool.query(
      'INSERT INTO repos (user_id, full_name, webhook_secret) VALUES ($1, $2, $3) RETURNING id, full_name, created_at',
      [res.locals.userId, fullName, webhookSecret],
    );

    const repo = result.rows[0];

    res.status(201).json({
      id: repo.id,
      fullName: repo.full_name,
      webhookUrl: `${process.env.PUBLIC_URL}/api/webhooks/github/${repo.id}`,
      webhookSecret,
      createdAt: repo.created_at,
    });
  } catch (err) {
    // 23505 is Postgres's code for "unique violation": this user already connected this repo
    if (err instanceof Error && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'You already connected this repo' });
      return;
    }
    throw err;
  }
});

export default reposRouter;
