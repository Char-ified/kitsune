import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pet, Repo, RepoEvent } from '@kitsune/shared';
import { api } from '../../api';
import { PetViewPage } from '../../pages/PetViewPage';

// Keep the real ApiError, but replace the api object with a fake.
vi.mock('../../api', async () => {
  const { ApiError } = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ApiError,
    api: {
      getRepos: vi.fn(),
      getPet: vi.fn(),
      getEvents: vi.fn(),
      updatePet: vi.fn(),
      disconnectRepo: vi.fn(),
    },
  };
});

const pet: Pet = {
  id: 1,
  name: 'Kitsu',
  character: 'kitsune',
  mood: 'happy',
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
};

const repo: Repo = {
  id: 1,
  fullName: 'Char-ified/kitsune',
  hasPet: true,
  pet: { name: 'Kitsu', character: 'kitsune', mood: 'happy' },
  createdAt: '2026-10-10T00:00:00.000Z',
};

const events: RepoEvent[] = [
  {
    id: 2,
    type: 'pr_merged',
    details: { number: 12, title: 'add login route' },
    createdAt: '2026-10-10T10:42:00.000Z',
  },
  {
    id: 1,
    type: 'tests_failed',
    details: { name: 'CI' },
    createdAt: '2026-10-10T09:58:00.000Z',
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/repos/1']}>
      <Routes>
        <Route path="/repos/:repoId" element={<PetViewPage />} />
        <Route path="/repos/:repoId/pick-character" element={<p>Pick character page</p>} />
        <Route path="/" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('PetViewPage', () => {
  beforeEach(() => {
    vi.mocked(api.getRepos).mockReset().mockResolvedValue([repo]);
    vi.mocked(api.getPet).mockReset().mockResolvedValue(pet);
    vi.mocked(api.getEvents).mockReset().mockResolvedValue(events);
    vi.mocked(api.updatePet).mockReset();
    vi.mocked(api.disconnectRepo).mockReset().mockResolvedValue({ deleted: true });
  });

  it('shows the pet, its mood, and its events', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Kitsu' })).toBeInTheDocument();
    expect(screen.getByText('Your guardian is thriving.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mood: happy' })).toBeInTheDocument();
    expect(screen.getByText('PR merged')).toBeInTheDocument();
    expect(screen.getByText('#12 add login route')).toBeInTheDocument();
    expect(screen.getByText('Tests failed')).toBeInTheDocument();
  });

  it('says it is listening when there are no events yet', async () => {
    vi.mocked(api.getEvents).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Listening for your first signal')).toBeInTheDocument();
  });

  it('renames the pet', async () => {
    vi.mocked(api.updatePet).mockResolvedValue({ ...pet, name: 'Mochi' });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    const input = screen.getByLabelText('Pet name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Mochi');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updatePet).toHaveBeenCalledWith(1, { name: 'Mochi' });
    expect(await screen.findByRole('heading', { name: 'Mochi' })).toBeInTheDocument();
  });

  it('asks before disconnecting, then goes back to the dashboard', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect repo' }));
    // The first click only asks. Nothing is deleted yet.
    expect(api.disconnectRepo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, disconnect' }));

    expect(api.disconnectRepo).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('sends a repo with no pet to pick a character', async () => {
    vi.mocked(api.getRepos).mockResolvedValue([{ ...repo, hasPet: false, pet: null }]);
    renderPage();

    expect(await screen.findByText('Pick character page')).toBeInTheDocument();
  });
});
