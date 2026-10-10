import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repo } from '@kitsune/shared';
import { api } from '../../api';
import { DashboardPage } from '../../pages/DashboardPage';

// Replace the api module, so each test decides what "the server" answers.
vi.mock('../../api', () => ({ api: { getRepos: vi.fn() } }));

const withPet: Repo = {
  id: 1,
  fullName: 'Char-ified/kitsune',
  hasPet: true,
  pet: { name: 'Kitsu', character: 'kitsune', mood: 'happy' },
  createdAt: '2026-10-10T00:00:00.000Z',
};

const withoutPet: Repo = {
  id: 2,
  fullName: 'demo-lab/moonlit-api',
  hasPet: false,
  pet: null,
  createdAt: '2026-10-10T00:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(api.getRepos).mockReset();
  });

  it('shows the empty state when there are no repos', async () => {
    vi.mocked(api.getRepos).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No repos connected yet')).toBeInTheDocument();
  });

  it('shows a card with the pet name and mood for a repo that has a pet', async () => {
    vi.mocked(api.getRepos).mockResolvedValue([withPet]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Kitsu' })).toBeInTheDocument();
    expect(screen.getByText('Char-ified/kitsune')).toBeInTheDocument();
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Webhook setup' })).toHaveAttribute(
      'href',
      '/repos/1/webhook',
    );
  });

  it('offers "Pick a character" for a repo with no pet', async () => {
    vi.mocked(api.getRepos).mockResolvedValue([withoutPet]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'No pet yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick a character' })).toBeInTheDocument();
  });

  it('shows an error when the repos cannot be loaded', async () => {
    vi.mocked(api.getRepos).mockRejectedValue(new Error('network down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your repos');
  });
});
