// Webhook route: receives GitHub's deliveries for one connected repo, and saves the ones
// the pet cares about as events (docs/API.md route 10).
// Public on purpose: GitHub can't log in, so the signature is its proof.
import express from 'express';
import pool from '../db.js';
import { toEvent } from './events.js';
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

  // Only now, with the signature confirmed, is the body read as JSON.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({
      error: 'Request body must be valid JSON. Set the webhook Content type to application/json',
    });
    return;
  }

  const event = toEvent(req.get('X-GitHub-Event'), payload);

  // Not an event we track (a ping, a comment, an opened pull request, ...): nothing to save.
  if (!event) {
    res.json({ received: true });
    return;
  }

  const deliveryId = req.get('X-GitHub-Delivery');
  if (!deliveryId) {
    res.status(400).json({ error: 'Missing X-GitHub-Delivery header' });
    return;
  }

  // GitHub can send the same delivery twice. github_delivery_id is UNIQUE, so
  // ON CONFLICT DO NOTHING skips a repeat instead of failing, and we still answer 200.
  await pool.query(
    `INSERT INTO events (repo_id, type, github_delivery_id, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_delivery_id) DO NOTHING`,
    [repo.id, event.type, deliveryId, JSON.stringify(event.details)],
  );

  res.json({ received: true });
});

export default webhooksRouter;
