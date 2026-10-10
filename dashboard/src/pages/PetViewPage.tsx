import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { EventType, Mood, Pet, Repo, RepoEvent } from '@kitsune/shared';
import { api, ApiError } from '../api';
import { Button } from '../components/Button';
import { MoodBadge } from '../components/MoodBadge';
import { MoodMeter } from '../components/MoodMeter';
import { Panel } from '../components/Panel';
import '../styles/PetViewPage.css';

// How often the page asks the server for fresh mood and events.
const REFRESH_MS = 30_000;

// What the page says for each mood.
const MOOD_COPY: Record<Mood, { headline: string; subline: string; quote: string }> = {
  happy: {
    headline: 'Your guardian is thriving.',
    subline: 'Good code. Good spirit.',
    quote: 'Another merge. Another victory.',
  },
  normal: {
    headline: 'Your guardian is keeping watch.',
    subline: 'All quiet in the repository.',
    quote: 'Standing by for your next move.',
  },
  sick: {
    headline: 'Your guardian needs care.',
    subline: 'Something broke. A passing test run will help.',
    quote: 'The tests... they hurt.',
  },
};

const EVENT_LABELS: Record<EventType, string> = {
  pr_merged: 'PR merged',
  tests_passed: 'Tests passed',
  tests_failed: 'Tests failed',
};

// The extra line under an event: "#12 add login route" for a PR, the workflow name for tests.
const describeEvent = (event: RepoEvent) => {
  const { number, title, name } = event.details;
  if (event.type === 'pr_merged') return [number && `#${number}`, title].filter(Boolean).join(' ');
  return name ?? '';
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type PageData = { repo: Repo; pet: Pet; events: RepoEvent[]; updatedAt: Date };

// Everything that can be on screen: the data, or one of four words saying why there is none.
type PageState = PageData | 'loading' | 'notFound' | 'noPet' | 'error';

// Gets everything the page shows. Lives outside the component because it needs no React state.
const fetchPage = async (repoId: number): Promise<PageState> => {
  const repos = await api.getRepos();
  const repo = repos.find((item) => item.id === repoId);
  if (!repo) return 'notFound';
  if (!repo.pet) return 'noPet';

  const [pet, events] = await Promise.all([api.getPet(repoId), api.getEvents(repoId)]);
  return { repo, pet, events, updatedAt: new Date() };
};

export const PetViewPage = () => {
  const navigate = useNavigate();
  const repoId = Number(useParams().repoId);
  const [page, setPage] = useState<PageState>('loading');

  // Rename form
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [renameError, setRenameError] = useState('');

  // Disconnect, which asks "are you sure?" first
  const [confirming, setConfirming] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');

  // Load once, then keep refreshing so a new event changes the mood without a page reload.
  useEffect(() => {
    const refresh = () =>
      fetchPage(repoId)
        .then(setPage)
        // If a background refresh fails, keep showing the last good data instead of an error.
        .catch(() => setPage((current) => (typeof current === 'string' ? 'error' : current)));

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [repoId]);

  if (page === 'noPet') return <Navigate to={`/repos/${repoId}/pick-character`} replace />;

  if (page === 'notFound') {
    return (
      <Panel title="Repo not found">
        <Link to="/">Back to my repos</Link>
      </Panel>
    );
  }

  if (page === 'error') return <p role="alert">Could not load this pet. Refresh to try again.</p>;

  if (page === 'loading') return <p className="pet-muted">Waking your guardian...</p>;

  const { repo, pet, events, updatedAt } = page;
  const copy = MOOD_COPY[pet.mood];

  const startRename = () => {
    setNameDraft(pet.name);
    setRenameError('');
    setRenaming(true);
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const updated = await api.updatePet(repoId, { name: nameDraft.trim() });
      setPage({ ...page, pet: updated });
      setRenaming(false);
    } catch (err) {
      setRenameError(err instanceof ApiError ? err.message : 'Could not rename. Try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectRepo(repoId);
      navigate('/');
    } catch {
      setDisconnectError('Could not disconnect. Try again.');
    }
  };

  return (
    <div>
      <div className="pet-heading">
        <div>
          <h1 className="pet-headline">{copy.headline}</h1>
          <p className="pet-muted">{copy.subline}</p>
        </div>
        <span className="pet-updated">Updated {formatTime(updatedAt)}</span>
      </div>

      <div className="pet-columns">
        <Panel>
          <div className="pet-stage">
            <img className="pet-fox" src={`/kitsune-${pet.mood}.png`} alt="" />
          </div>

          {renaming ? (
            <form className="pet-rename" onSubmit={handleRename}>
              <input
                className={renameError ? 'input input-error' : 'input'}
                aria-label="Pet name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                autoFocus
              />
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              {renameError && (
                <p className="field-error" role="alert">
                  {renameError}
                </p>
              )}
            </form>
          ) : (
            <div className="pet-name-row">
              <h2 className="pet-name">{pet.name}</h2>
              <MoodBadge mood={pet.mood} />
              <button className="pet-link" onClick={startRename}>
                Rename
              </button>
              <q className="pet-quote">{copy.quote}</q>
            </div>
          )}

          <p className="pet-label">Spirit meter</p>
          <MoodMeter mood={pet.mood} />
        </Panel>

        <Panel title="Recent events">
          {events.length === 0 ? (
            <div className="pet-empty">
              <p className="pet-empty-title">Listening for your first signal</p>
              <p className="pet-muted">
                Merge a pull request or run your tests to wake your kitsune.
              </p>
            </div>
          ) : (
            <>
              <ul className="event-list">
                {events.map((event) => (
                  <li key={event.id} className={`event event-${event.type}`}>
                    <time className="event-time">{formatTime(new Date(event.createdAt))}</time>
                    <div>
                      <p className="event-title">{EVENT_LABELS[event.type]}</p>
                      <p className="event-detail">{describeEvent(event)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="pet-listening">Listening for the next signal...</p>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Bound repository">
        <div className="pet-repo">
          <div>
            <p className="pet-repo-name">{repo.fullName}</p>
            <p className="pet-muted">Pull requests and test runs reach your pet by webhook.</p>
          </div>

          {confirming ? (
            <div className="pet-confirm">
              <p>
                Disconnect {repo.fullName}? This removes {pet.name} and all events.
              </p>
              <div className="pet-repo-actions">
                <button className="btn pet-danger" onClick={handleDisconnect}>
                  Yes, disconnect
                </button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="pet-repo-actions">
              <Button variant="secondary" onClick={() => navigate(`/repos/${repo.id}/webhook`)}>
                Webhook setup
              </Button>
              <button className="btn pet-danger" onClick={() => setConfirming(true)}>
                Disconnect repo
              </button>
            </div>
          )}
        </div>
        {disconnectError && (
          <p className="field-error" role="alert">
            {disconnectError}
          </p>
        )}
      </Panel>
    </div>
  );
};
