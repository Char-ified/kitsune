// Repo routes: list, connect, disconnect, and new webhook secret (docs/API.md routes 5, 6, 12, 13).
import crypto from 'node:crypto';
import express from 'express';
import type { Character, ConnectedRepo, Repo, WebhookDetails } from '@kitsune/shared';
import { requireAuth } from '../auth/middleware.js';
import { requireRepoOwner } from '../auth/ownership.js';
import pool from '../db.js';

const reposRouter = express.Router();

// One row from the list query: a repo, plus its pet's columns (null when it has no pet).
type RepoRow = {
  id: number;
  full_name: string;
  created_at: Date;
  pet_name: string | null;
  pet_character: Character | null;
};

const FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const newWebhookSecret = (): string => crypto.randomBytes(32).toString('hex');

// The address the user pastes into GitHub's webhook settings.
const webhookUrlFor = (repoId: number): string =>
  `${process.env.PUBLIC_URL}/api/webhooks/github/${repoId}`;

// 5. List my repos
reposRouter.get('/', requireAuth, async (req, res) => {
  // LEFT JOIN keeps repos that have no pet yet; their pet columns come back null.
  const result = await pool.query<RepoRow>(
    `SELECT repos.id, repos.full_name, repos.created_at,
            pets.name AS pet_name, pets.character AS pet_character
     FROM repos
     LEFT JOIN pets ON pets.repo_id = repos.id
     WHERE repos.user_id = $1
     ORDER BY repos.created_at, repos.id`,
    [res.locals.userId],
  );

  const repos: Repo[] = result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    hasPet: row.pet_name !== null,
    pet:
      row.pet_name === null || row.pet_character === null
        ? null
        : // Mood is calculated, never stored. Every pet is "normal" until the mood logic lands (CHA-17).
          { name: row.pet_name, character: row.pet_character, mood: 'normal' },
    createdAt: row.created_at.toISOString(),
  }));

  res.json(repos);
});

// 6. Connect a repo
reposRouter.post('/', requireAuth, async (req, res) => {
  const rawFullName: unknown = req.body?.fullName;
  const fullName = typeof rawFullName === 'string' ? rawFullName.trim() : '';

  if (!FULL_NAME_PATTERN.test(fullName)) {
    res.status(400).json({ error: 'Use the format owner/repo-name' });
    return;
  }

  const webhookSecret = newWebhookSecret();

  try {
    const result = await pool.query(
      'INSERT INTO repos (user_id, full_name, webhook_secret) VALUES ($1, $2, $3) RETURNING id, full_name, created_at',
      [res.locals.userId, fullName, webhookSecret],
    );

    const repo = result.rows[0];

    const connected: ConnectedRepo = {
      id: repo.id,
      fullName: repo.full_name,
      webhookUrl: webhookUrlFor(repo.id),
      webhookSecret,
      createdAt: repo.created_at.toISOString(),
    };
    res.status(201).json(connected);
  } catch (err) {
    // 23505 is Postgres's code for "unique violation": this user already connected this repo
    if (err instanceof Error && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'You already connected this repo' });
      return;
    }
    throw err;
  }
});

// 12. Disconnect a repo. requireRepoOwner has already confirmed it belongs to this user.
reposRouter.delete('/:repoId', requireAuth, requireRepoOwner, async (req, res) => {
  // The repo's pet and events go with it (ON DELETE CASCADE in schema.sql).
  await pool.query('DELETE FROM repos WHERE id = $1', [res.locals.repo.id]);

  res.json({ deleted: true });
});

// 13. New webhook secret: the fix for "I lost my secret"
reposRouter.post('/:repoId/webhook-secret', requireAuth, requireRepoOwner, async (req, res) => {
  const repoId: number = res.locals.repo.id;
  const webhookSecret = newWebhookSecret();

  await pool.query('UPDATE repos SET webhook_secret = $1 WHERE id = $2', [webhookSecret, repoId]);

  const details: WebhookDetails = { webhookUrl: webhookUrlFor(repoId), webhookSecret };
  res.json(details);
});

export default reposRouter;
