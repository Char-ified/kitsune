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

### Run the server

```bash
npm run dev:server
```

Starts the Express server on http://localhost:3000. Routes are added in later issues; see [docs/API.md](docs/API.md).

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

## Useful scripts (run from the root)

| Script                 | What it does                          |
| ---------------------- | ------------------------------------- |
| `npm run typecheck`    | Checks TypeScript in every package    |
| `npm run lint`         | Finds code problems with ESLint       |
| `npm run format`       | Formats all code with Prettier        |
| `npm run format:check` | Checks formatting without changing it |
