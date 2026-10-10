import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../api';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { SetupSteps } from '../components/SetupSteps';
import { TextInput } from '../components/TextInput';
import '../styles/SetupPages.css';

export const ConnectRepoPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const name = fullName.trim();
    if (!name) {
      setError('Enter a repository, like owner/repo-name');
      return;
    }

    setSubmitting(true);
    try {
      const repo = await api.connectRepo(name);
      // The fun part comes next: choosing a pet for this repo.
      navigate(`/repos/${repo.id}/pick-character`);
    } catch (err) {
      // An ApiError carries the server's own message (bad format, already connected).
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SetupSteps current={1} />
      <h1 className="setup-title">Connect a repo</h1>
      <p className="setup-subtitle">Bring your repository's PR and CI signals to its guardian.</p>

      <div className="setup-columns">
        <Panel title="Choose your repository">
          <p className="setup-muted">Use the owner and repository name from GitHub.</p>
          <form onSubmit={handleSubmit} noValidate>
            <TextInput
              label="Repository · owner/repo-name"
              placeholder="owner/repo-name"
              autoComplete="off"
              spellCheck={false}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={error || undefined}
            />
            <p className="setup-hint">Enter owner/repo-name, without the github.com URL.</p>
            <div className="setup-form-actions">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Connecting...' : 'Connect a repo →'}
              </Button>
              <Link className="setup-cancel" to="/">
                Cancel
              </Link>
            </div>
          </form>
        </Panel>

        <Panel title="A signal, not a code reader">
          <p className="setup-muted">
            Kitsune listens to repository events. Your source code stays in GitHub.
          </p>
          <ul className="setup-checklist">
            <li>You need admin access to add a GitHub webhook.</li>
            <li>Next, choose your kitsune and give it a name.</li>
            <li>Then copy the webhook URL and secret into GitHub.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
};
