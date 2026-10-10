// Translates GitHub's webhook deliveries into the three events the pet cares about
// (docs/API.md route 10, "Event mapping" and "Event details").
import type { EventType, RepoEvent } from '@kitsune/shared';

export type NewEvent = { type: EventType; details: RepoEvent['details'] };

// GitHub's payloads are large; these are only the fields we read. Everything is optional
// because the body comes from outside and may not have the shape we expect.
type PullRequestPayload = {
  action?: string;
  pull_request?: { merged?: boolean; number?: number; title?: string; html_url?: string };
};

type WorkflowRunPayload = {
  action?: string;
  workflow_run?: {
    conclusion?: string | null;
    name?: string;
    html_url?: string;
    pull_requests?: { number?: number }[];
  };
};

const fromPullRequest = (payload: PullRequestPayload): NewEvent | null => {
  const pr = payload.pull_request;

  // "closed" covers both merged and abandoned pull requests; only merged ones count.
  if (payload.action !== 'closed' || pr?.merged !== true) return null;

  return { type: 'pr_merged', details: { number: pr.number, title: pr.title, url: pr.html_url } };
};

const fromWorkflowRun = (payload: WorkflowRunPayload): NewEvent | null => {
  const run = payload.workflow_run;
  if (payload.action !== 'completed' || !run) return null;

  // Other conclusions (cancelled, skipped, timed_out, ...) say nothing about the tests.
  let type: EventType;
  if (run.conclusion === 'success') type = 'tests_passed';
  else if (run.conclusion === 'failure') type = 'tests_failed';
  else return null;

  return {
    type,
    // `number` is the pull request the run was for, when there is one.
    details: { name: run.name, url: run.html_url, number: run.pull_requests?.[0]?.number },
  };
};

// Returns the event to save, or null when this delivery isn't one we track
// (including GitHub's "ping" when a webhook is first set up).
export const toEvent = (githubEvent: string | undefined, payload: unknown): NewEvent | null => {
  if (typeof payload !== 'object' || payload === null) return null;

  if (githubEvent === 'pull_request') return fromPullRequest(payload);
  if (githubEvent === 'workflow_run') return fromWorkflowRun(payload);
  return null;
};
