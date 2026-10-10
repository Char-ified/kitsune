-- Kitsune Repo Pet database schema (see docs/API.md and Linear CHA-36)
-- Safe to run more than once: IF NOT EXISTS skips tables that already exist.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, full_name)
);

CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER NOT NULL UNIQUE REFERENCES repos (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  character TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  github_delivery_id TEXT NOT NULL UNIQUE,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Speeds up "latest events for this repo", which the mood logic and event log both use.
CREATE INDEX IF NOT EXISTS events_repo_created_idx ON events (repo_id, created_at DESC);