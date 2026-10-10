import type { NextFunction, Request, Response } from 'express';
import pool from '../db.js';

// Runs after requireAuth on any route with :repoId. Confirms the repo belongs to
// the logged-in user and saves it in res.locals.repo for the route to use
// "Not yours" gets the same 404 as "doesnt exist" so nobody can find out
// which repo IDs are reall (see docs/API.md, "Ownership check")
export const requireRepoOwner = async (req: Request, res: Response, next: NextFunction) => {
  const repoId = Number(req.params.repoId);

  if (!Number.isInteger(repoId) || repoId <= 0) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  const result = await pool.query(
    'SELECT id, user_id, full_name, created_at FROM repos WHERE id = $1 AND user_id = $2',
    [repoId, res.locals.userId],
  );
  const repo = result.rows[0];

  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  res.locals.repo = repo;
  next();
};
