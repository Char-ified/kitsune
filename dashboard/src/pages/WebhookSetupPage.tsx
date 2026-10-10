import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Repo, WebhookDetails } from '@kitsune/shared';
import { api } from '../api';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { SetupSteps } from '../components/SetupSteps';
import '../styles/SetupPages.css';

const GITHUB_STEPS = [
  {
    title: 'Open your webhook settings',
    text: 'In your GitHub repo: Settings, then Webhooks, then Add webhook.',
  },
  { title: 'Paste the Payload URL', text: 'Use the webhook URL from this page.' },
  {
    title: 'Set Content type to application/json',
    text: "GitHub's default is different, and it will not work.",
  },
  { title: 'Paste the secret', text: 'Use the webhook secret from this page.' },
  {
    title: 'Choose "Let me select individual events"',
    text: 'Check Pull requests and Workflow runs. Uncheck Pushes.',
  },
  { title: 'Click Add webhook', text: 'GitHub sends a test ping right away.' },
];

// One read-only value with a Copy button next to it.
const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-row">
        <code className="copy-field-value">{value}</code>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
};

export const WebhookSetupPage = () => {
  const navigate = useNavigate();
  const repoId = Number(useParams().repoId);
  // undefined = still loading, null = no such repo.
  const [repo, setRepo] = useState<Repo | null | undefined>(undefined);
  const [details, setDetails] = useState<WebhookDetails | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .getRepos()
      .then((repos) => setRepo(repos.find((item) => item.id === repoId) ?? null))
      .catch(() => setError('Could not load this repo. Refresh to try again.'));
  }, [repoId]);

  // A secret is only ever shown at the moment it is made, so the page asks for a fresh one.
  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      setDetails(await api.newWebhookSecret(repoId));
    } catch {
      setError('Could not generate a secret. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (repo === null) {
    return (
      <Panel title="Repo not found">
        <Link to="/">Back to my repos</Link>
      </Panel>
    );
  }

  if (repo === undefined) {
    return error ? <p role="alert">{error}</p> : <p className="setup-muted">Loading...</p>;
  }

  return (
    <div>
      <SetupSteps current={3} />
      <h1 className="setup-title">Set up your webhook</h1>
      <p className="setup-subtitle">
        One last connection between GitHub and your repository spirit.
      </p>

      <div className="setup-columns">
        <Panel>
          <span className="copy-field-label">Repository</span>
          <p className="setup-repo-name">{repo.fullName}</p>

          {details ? (
            <>
              <p className="setup-warning">
                The secret is only shown once. Copy it now. If you lose it, generate a new one here
                and update it in GitHub.
              </p>
              <CopyField label="Webhook URL" value={details.webhookUrl} />
              <CopyField label="Webhook secret" value={details.webhookSecret} />
              <Button type="button" variant="secondary" onClick={handleGenerate}>
                {generating ? 'Generating...' : 'Generate new secret'}
              </Button>
            </>
          ) : (
            <>
              <p className="setup-muted">
                Generate a secret to get the two values GitHub needs. If this repo already has a
                webhook, the old secret stops working, so you will need to update it in GitHub.
              </p>
              <Button type="button" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate webhook secret'}
              </Button>
            </>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </Panel>

        <Panel title="In GitHub">
          <p className="setup-muted">Paste these values into your repo settings.</p>
          <ol className="github-steps">
            {GITHUB_STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="setup-step-number">{`0${index + 1}`}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p className="setup-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="setup-footer">
        <p className="setup-muted">Your pet starts reacting once the webhook is saved in GitHub.</p>
        <div className="setup-footer-actions">
          <Button variant="secondary" onClick={() => navigate(`/repos/${repo.id}`)}>
            Skip for now
          </Button>
          <Button onClick={() => navigate(`/repos/${repo.id}`)}>Done →</Button>
        </div>
      </div>
    </div>
  );
};
