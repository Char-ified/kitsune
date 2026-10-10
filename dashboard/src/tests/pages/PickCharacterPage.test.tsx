import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pet, Repo } from '@kitsune/shared';
import { api, ApiError } from '../../api';
import { PickCharacterPage } from '../../pages/PickCharacterPage';

// Keep the real ApiError, but replace the api object with a fake.
vi.mock('../../api', async () => {
  const { ApiError } = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ApiError, api: { getRepos: vi.fn(), createPet: vi.fn() } };
});

const repo: Repo = {
  id: 2,
  fullName: 'demo-lab/moonlit-api',
  hasPet: false,
  pet: null,
  createdAt: '2026-10-10T00:00:00.000Z',
};

const pet: Pet = {
  id: 5,
  name: 'Yoru',
  character: 'kitsune',
  mood: 'normal',
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/repos/2/pick-character']}>
      <Routes>
        <Route path="/repos/:repoId/pick-character" element={<PickCharacterPage />} />
        <Route path="/repos/:repoId/webhook" element={<p>Webhook setup page</p>} />
        <Route path="/repos/:repoId" element={<p>Pet view page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('PickCharacterPage', () => {
  beforeEach(() => {
    vi.mocked(api.getRepos).mockReset().mockResolvedValue([repo]);
    vi.mocked(api.createPet).mockReset().mockResolvedValue(pet);
  });

  it('creates a kitsune with the trimmed name and moves on to webhook setup', async () => {
    renderPage();

    await userEvent.type(await screen.findByLabelText('Pet name'), '  Yoru ');
    await userEvent.click(screen.getByRole('button', { name: /Create pet/ }));

    expect(api.createPet).toHaveBeenCalledWith(2, { name: 'Yoru', character: 'kitsune' });
    expect(await screen.findByText('Webhook setup page')).toBeInTheDocument();
  });

  it('does not call the server when the name is empty', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Create pet/ }));

    expect(api.createPet).not.toHaveBeenCalled();
    expect(screen.getByText('Give your pet a name')).toBeInTheDocument();
  });

  it("shows the server's message when creating fails", async () => {
    vi.mocked(api.createPet).mockRejectedValue(new ApiError(409, 'This repo already has a pet'));
    renderPage();

    await userEvent.type(await screen.findByLabelText('Pet name'), 'Yoru');
    await userEvent.click(screen.getByRole('button', { name: /Create pet/ }));

    expect(await screen.findByText('This repo already has a pet')).toBeInTheDocument();
  });

  it('shows the other characters as coming soon', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Tanuki' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nekomata' })).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('skips straight to the pet view when the repo already has a pet', async () => {
    vi.mocked(api.getRepos).mockResolvedValue([
      { ...repo, hasPet: true, pet: { name: 'Yoru', character: 'kitsune', mood: 'normal' } },
    ]);
    renderPage();

    expect(await screen.findByText('Pet view page')).toBeInTheDocument();
  });
});
