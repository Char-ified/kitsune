import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { Repo } from '@kitsune/shared';
import { api, ApiError } from '../api';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { SetupSteps } from '../components/SetupSteps';
import { TextInput } from '../components/TextInput';
import '../styles/SetupPages.css';
import '../styles/PickCharacterPage.css';

// Characters we show but can't pick yet. Adding one for real means a sprite set and
// a new value in the shared Character type.
const LOCKED = [
  { name: 'Tanuki', text: 'A woodland companion for a future chapter. Not available yet.' },
  { name: 'Nekomata', text: 'A curious two-tailed spirit. Not available yet.' },
];

const LockIcon = () => (
  <svg className="character-lock" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 7V5a4 4 0 0 1 8 0v2h1v7H3V7h1zm2 0h4V5a2 2 0 0 0-4 0v2z" fill="currentColor" />
  </svg>
);

// The repo, or a word saying why there isn't one.
type PageState = Repo | 'loading' | 'notFound' | 'error';

export const PickCharacterPage = () => {
  const navigate = useNavigate();
  const repoId = Number(useParams().repoId);
  const [page, setPage] = useState<PageState>('loading');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getRepos()
      .then((repos) => setPage(repos.find((item) => item.id === repoId) ?? 'notFound'))
      .catch(() => setPage('error'));
  }, [repoId]);

  if (page === 'loading') return <p className="setup-muted">Loading...</p>;

  if (page === 'error') return <p role="alert">Could not load this repo. Refresh to try again.</p>;

  if (page === 'notFound') {
    return (
      <Panel title="Repo not found">
        <Link to="/">Back to my repos</Link>
      </Panel>
    );
  }

  // One pet per repo. If it already has one, there is nothing to pick.
  if (page.pet) return <Navigate to={`/repos/${repoId}`} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const petName = name.trim();
    if (!petName) {
      setError('Give your pet a name');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPet(repoId, { name: petName, character: 'kitsune' });
      // Last step of setup: tell GitHub where to send events.
      navigate(`/repos/${repoId}/webhook`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SetupSteps current={2} />
      <h1 className="setup-title">Pick your character</h1>
      <p className="setup-subtitle">
        Choose a guardian for <code className="character-repo">{page.fullName}</code>, then give it
        a name.
      </p>

      <ul className="character-grid">
        <li className="character-card character-card-selected" aria-current="true">
          <span className="character-tag">Selected</span>
          <div className="character-stage">
            <img className="character-fox" src="/kitsune-happy.png" alt="" />
          </div>
          <h2 className="character-name">Kitsune</h2>
          <p className="setup-muted">
            A small fox spirit that grows with every merge and passing test.
          </p>
        </li>

        {LOCKED.map((character) => (
          <li key={character.name} className="character-card character-card-locked">
            <span className="character-tag">Coming soon</span>
            <div className="character-stage">
              <LockIcon />
            </div>
            <h2 className="character-name">{character.name}</h2>
            <p className="setup-muted">{character.text}</p>
          </li>
        ))}
      </ul>

      <Panel>
        <form className="character-form" onSubmit={handleSubmit} noValidate>
          <div>
            <TextInput
              label="Pet name"
              placeholder="Kitsu"
              autoComplete="off"
              maxLength={30}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={error || undefined}
            />
            <p className="setup-hint">You can rename your kitsune later.</p>
          </div>
          <div className="setup-form-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create pet →'}
            </Button>
            <Link className="setup-cancel" to="/">
              Do this later
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
};
