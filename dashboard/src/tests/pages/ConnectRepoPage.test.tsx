import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../api';
import { ConnectRepoPage } from '../../pages/ConnectRepoPage';

// Keep the real ApiError, but replace the api object with a fake.
vi.mock('../../api', async () => {
  const { ApiError } = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ApiError, api: { connectRepo: vi.fn() } };
});

// Two tiny stand-in pages, so the tests can see where the user ends up.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/connect']}>
      <Routes>
        <Route path="/connect" element={<ConnectRepoPage />} />
        <Route path="/repos/:repoId/pick-character" element={<p>Pick character page</p>} />
        <Route path="/" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const repoInput = () => screen.getByLabelText(/Repository/);
const submit = () => screen.getByRole('button', { name: /Connect a repo/ });

describe('ConnectRepoPage', () => {
  beforeEach(() => {
    vi.mocked(api.connectRepo).mockReset();
  });

  it('connects the repo and moves on to picking a character', async () => {
    vi.mocked(api.connectRepo).mockResolvedValue({
      id: 7,
      fullName: 'maia/new-repo',
      createdAt: '2026-10-10T00:00:00.000Z',
      webhookUrl: 'http://localhost:3000/api/webhooks/github/7',
      webhookSecret: 'secret',
    });
    renderPage();

    await userEvent.type(repoInput(), '  maia/new-repo  ');
    await userEvent.click(submit());

    expect(api.connectRepo).toHaveBeenCalledWith('maia/new-repo');
    expect(await screen.findByText('Pick character page')).toBeInTheDocument();
  });

  it("shows the server's message when the repo is already connected", async () => {
    vi.mocked(api.connectRepo).mockRejectedValue(
      new ApiError(409, 'You already connected this repo'),
    );
    renderPage();

    await userEvent.type(repoInput(), 'maia/new-repo');
    await userEvent.click(submit());

    expect(await screen.findByText('You already connected this repo')).toBeInTheDocument();
    expect(repoInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not call the server when the input is empty', async () => {
    renderPage();

    await userEvent.click(submit());

    expect(api.connectRepo).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a repository, like owner/repo-name')).toBeInTheDocument();
  });

  it('goes back to the dashboard on Cancel', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });
});
