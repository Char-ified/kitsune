// Works out which repo a GitHub page belongs to, and finds it among the user's connected repos.
// No Chrome or DOM code in here, so it can be unit tested.
import type { Repo } from '@kitsune/shared';

// First parts of a github.com path that are GitHub's own pages, not a user or organization.
const NOT_AN_OWNER = new Set([
  'about',
  'codespaces',
  'collections',
  'dashboard',
  'enterprise',
  'explore',
  'features',
  'issues',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
]);

// "/Char-ified/kitsune/pull/12" -> "Char-ified/kitsune". Returns null when the page isn't a repo.
export const repoFromPath = (pathname: string): string | null => {
  const [owner, name] = pathname.split('/').filter(Boolean);
  if (!owner || !name || NOT_AN_OWNER.has(owner.toLowerCase())) return null;
  return `${owner}/${name}`;
};

// GitHub treats "Maia/Demo" and "maia/demo" as the same repo, so compare in lowercase.
export const findRepo = (repos: Repo[], fullName: string): Repo | undefined =>
  repos.find((repo) => repo.fullName.toLowerCase() === fullName.toLowerCase());
