import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Mood, Repo } from '@kitsune/shared';
import { api } from '../api';
import { Button } from '../components/Button';
import { MoodBadge } from '../components/MoodBadge';
import { Panel } from '../components/Panel';
import '../styles/DashboardPage.css';

const SPRITES: Record<Mood, string> = {
  happy: '/kitsune-happy.png',
  normal: '/kitsune-normal.png',
  sick: '/kitsune-sick.png',
};

// One card in the grid. It has two looks: a repo with a pet, and a repo still waiting for one
const RepoCard = ({ repo }: { repo: Repo }) => {
  const navigate = useNavigate();

  if (!repo.pet) {
    return (
      <li className="repo-card">
        <div className="repo-card-stage">
          <img className="repo-card-fox" src="/kitsune-unknown.png" alt="" />
        </div>
        <h2 className="repo-card-name">No pet yet</h2>
        <p className="repo-card-repo">{repo.fullName}</p>
        <div className="repo-card-actions">
          <Button onClick={() => navigate(`/repos/${repo.id}/pick-character`)}>
            Pick a character
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="repo-card">
      <div className={`repo-card-stage repo-card-stage-${repo.pet.mood}`}>
        <img className="repo-card-fox" src={SPRITES[repo.pet.mood]} alt="" />
      </div>
      <div className="repo-card-heading">
        <h2 className="repo-card-name">{repo.pet.name}</h2>
        <MoodBadge mood={repo.pet.mood} />
      </div>
      <p className="repo-card-repo">{repo.fullName}</p>
      <div className="repo-card-actions">
        <Button onClick={() => navigate(`/repos/${repo.id}`)}>Open</Button>
        <Link className="repo-card-link" to={`/repos/${repo.id}/webhook`}>
          Webhook setup
        </Link>
      </div>
    </li>
  );
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  // null means "still loading", so an empty list can mean "no repos yet".
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getRepos()
      .then(setRepos)
      .catch(() => setError('Could not load your repos. Refresh to try again.'));
  }, []);

  if (error) {
    return (
      <Panel>
        <p role="alert">{error}</p>
      </Panel>
    );
  }

  if (repos === null) {
    return <p className="dashboard-loading">Loading your repos...</p>;
  }

  if (repos.length === 0) {
    return (
      <div className="dashboard-empty">
        <img className="dashboard-empty-fox" src="/kitsune-happy.png" alt="" />
        <h1 className="dashboard-title">No repos connected yet</h1>
        <p className="dashboard-muted">Connect a GitHub repo to hatch your first pet.</p>
        <Button onClick={() => navigate('/connect')}>Connect a repo →</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-heading">
        <h1 className="dashboard-title">My repos</h1>
        <Button onClick={() => navigate('/connect')}>Connect a repo →</Button>
      </div>

      <ul className="repo-grid">
        {repos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
        <li>
          <Link className="repo-card-add" to="/connect">
            <span className="repo-card-plus">+</span>
            Connect a repo
          </Link>
        </li>
      </ul>
    </div>
  );
};
