import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repo } from '@kitsune/shared';
import { api } from '../../api';
import { WebhookSetupPage } from '../../pages/WebhookSetupPage';

vi.mock('../../api', () => ({ api: { getRepos: vi.fn(), newWebhookSecret: vi.fn() } }));

const repo: Repo = {
  id: 1,
  fullName: 'Char-ified/kitsune',
  hasPet: true,
  pet: { name: 'Kitsu', character: 'kitsune', mood: 'happy' },
  createdAt: '2026-10-10T00:00:00.000Z',
};

const renderPage = (path = '/repos/1/webhook') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/repos/:repoId/webhook" element={<WebhookSetupPage />} />
        <Route path="/repos/:repoId" element={<p>Pet view page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('WebhookSetupPage', () => {
  beforeEach(() => {
    vi.mocked(api.getRepos).mockReset().mockResolvedValue([repo]);
    vi.mocked(api.newWebhookSecret).mockReset().mockResolvedValue({
      webhookUrl: 'http://localhost:3000/api/webhooks/github/1',
      webhookSecret: 'fake_secret_abc',
    });
  });

  it('does not create a secret until the user asks for one', async () => {
    renderPage();

    expect(await screen.findByText('Char-ified/kitsune')).toBeInTheDocument();
    expect(api.newWebhookSecret).not.toHaveBeenCalled();
  });

  it('shows the URL and secret after generating', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Generate webhook secret' }));

    expect(
      await screen.findByText('http://localhost:3000/api/webhooks/github/1'),
    ).toBeInTheDocument();
    expect(screen.getByText('fake_secret_abc')).toBeInTheDocument();
    expect(api.newWebhookSecret).toHaveBeenCalledWith(1);
  });

  it('goes to the pet view on Done', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Done/ }));

    expect(screen.getByText('Pet view page')).toBeInTheDocument();
  });

  it('says so when the repo does not exist', async () => {
    renderPage('/repos/999/webhook');

    expect(await screen.findByRole('heading', { name: 'Repo not found' })).toBeInTheDocument();
  });
});
