// Where the extension finds our server and dashboard.
// The build decides which: `npm run build:extension` talks to your own computer,
// `npm run build:extension:live` talks to the deployed site (CHA-27).
// Both addresses are also listed under host_permissions in manifest.json.
declare const __KITSUNE_LIVE__: boolean;

const LIVE_URL = 'https://kitsune-1w6r.onrender.com';

// Live: the server also serves the dashboard, so both are the same address.
export const SERVER_URL = __KITSUNE_LIVE__ ? LIVE_URL : 'http://localhost:3000';
export const DASHBOARD_URL = __KITSUNE_LIVE__ ? LIVE_URL : 'http://localhost:5173';
