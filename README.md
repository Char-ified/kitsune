# Kitsune Repo Pet

A companion character that lives in a Chrome extension and reacts to what happens in your GitHub repo. Users log in, connect a repo, and pick a character in a React dashboard.

## Project structure

| Folder       | What it is                                                    |
| ------------ | ------------------------------------------------------------- |
| `server/`    | Express + TypeScript API                                      |
| `dashboard/` | React + TypeScript dashboard (Vite)                           |
| `extension/` | Chrome extension (Manifest V3, TypeScript)                    |
| `shared/`    | TypeScript types used by all three (e.g. `Mood`, `EventType`) |

This is one repo using **npm workspaces**, so a single `npm install` at the root installs everything.

## Getting started

Requires Node 24 (see `.nvmrc`). If you use nvm, run `nvm use`.

```bash
npm install
cp server/.env.example server/.env
```

### Set up your local database

You need PostgreSQL running on your computer. Create a database and its tables:

```bash
createdb kitsune_dev
psql -d kitsune_dev -f server/db/schema.sql
```

Then fill in `server/.env`:

```
DATABASE_URL=postgres://localhost/kitsune_dev
JWT_SECRET=<any long random string>
PUBLIC_URL=http://localhost:3000
```

To generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Your local database is yours alone. It's safe to fill with test data or wipe. The shared Supabase database is only used by the deployed app.

### Try it

Run the server and the dashboard (two terminals), then open http://localhost:5173/signup and create an account. You should land on the dashboard.

### Run the server

```bash
npm run dev:server
```

Check it at http://localhost:3000/api/health. It should return `{"status":"ok"}`. All routes are listed in [docs/API.md](docs/API.md).

### Run the dashboard

In a second terminal:

```bash
npm run dev:dashboard
```

Open http://localhost:5173. Requests to `/api` are forwarded to the server.

### Build and load the extension

```bash
npm run build:extension
```

In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `extension/dist`. After rebuilding, click the reload icon on the extension's card.

## Docs

- [API contract](docs/API.md): every route, its input and output, and the decisions behind them
- [Contributing](CONTRIBUTING.md): branches, commits, and pull requests
- [User flow](docs/USER-FLOW.md): every page, how they connect, and why

## Useful scripts (run from the root)

| Script                 | What it does                          |
| ---------------------- | ------------------------------------- |
| `npm run typecheck`    | Checks TypeScript in every package    |
| `npm run lint`         | Finds code problems with ESLint       |
| `npm run format`       | Formats all code with Prettier        |
| `npm run format:check` | Checks formatting without changing it |
