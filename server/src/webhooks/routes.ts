// Webhook route: receives GitHub's deliveries for one connected repo (docs/API.md route 10).
// Public on purpose: GitHub can't log in, so the signature is its proof.
import express from 'express';
import pool from '../db.js';
import { isValidSignature } from './signature.js';

const webhooksRouter = express.Router();

// repos.id is a Postgres INTEGER, so anything larger can't be a real ID.
const MAX_REPO_ID = 2147483647;

// 10. GitHub event
webhooksRouter.post('/github/:repoId', async (req, res) => {
  const repoId = Number(req.params.repoId);

  if (!Number.isInteger(repoId) || repoId <= 0 || repoId > MAX_REPO_ID) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  const result = await pool.query('SELECT id, webhook_secret FROM repos WHERE id = $1', [repoId]);
  const repo = result.rows[0];

  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  // app.ts keeps the body as raw bytes for /api/webhooks, exactly as GitHub sent it.
  // A request with no body leaves req.body unset, which can never match a signature.
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  if (!isValidSignature(rawBody, repo.webhook_secret, req.get('X-Hub-Signature-256'))) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  res.json({ received: true });
});

export default webhooksRouter;
