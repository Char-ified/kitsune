// Event log route: the events saved for one repo, newest first (docs/API.md route 9).
// requireAuth and requireRepoOwner run before this route (see app.ts),
// so by now we know who the user is and that res.locals.repo belongs to them.
import { Router } from 'express';
import type { EventType, RepoEvent } from '@kitsune/shared';
import pool from '../db.js';

const eventsRouter = Router();

const DEFAULT_LIMIT = 20;
// A ceiling, so one request can't ask for a repo's entire history at once.
const MAX_LIMIT = 100;

type EventRow = {
  id: number;
  type: EventType;
  details: RepoEvent['details'];
  created_at: Date;
};

// Reads ?limit= from the URL. Anything that isn't a positive whole number
// (missing, "abc", 0, 2.5) falls back to the default instead of being an error.
const parseLimit = (value: unknown): number => {
  const limit = Number(value);
  if (typeof value !== 'string' || !Number.isInteger(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
};

// 9. Get the event log
eventsRouter.get('/', async (req, res) => {
  const limit = parseLimit(req.query.limit);

  // `id DESC` settles the order when two events were saved in the same instant.
  const result = await pool.query<EventRow>(
    `SELECT id, type, details, created_at
     FROM events
     WHERE repo_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [res.locals.repo.id, limit],
  );

  const events: RepoEvent[] = result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    details: row.details,
    createdAt: row.created_at.toISOString(),
  }));

  res.json(events);
});

export default eventsRouter;
