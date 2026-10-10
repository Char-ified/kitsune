import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import { mockApi } from '../../api/mocks';

// These walk the same path a new user takes: connect, pick a character, view the pet.
describe('mock API', () => {
  it('lists repos, each with a pet summary or null', async () => {
    const repos = await mockApi.getRepos();

    expect(repos.length).toBeGreaterThan(0);
    for (const repo of repos) {
      expect(repo.hasPet).toBe(repo.pet !== null);
    }
  });

  it('supports the full setup flow', async () => {
    const connected = await mockApi.connectRepo('maia/new-repo');
    expect(connected.webhookUrl).toContain(`/api/webhooks/github/${connected.id}`);
    expect(connected.webhookSecret).toEqual(expect.any(String));

    // A newly connected repo has no pet yet.
    await expect(mockApi.getPet(connected.id)).rejects.toMatchObject({ status: 404 });

    const pet = await mockApi.createPet(connected.id, { name: 'Miso', character: 'kitsune' });
    expect(pet.name).toBe('Miso');

    const renamed = await mockApi.updatePet(connected.id, { name: 'Mochi' });
    expect(renamed.name).toBe('Mochi');

    await mockApi.disconnectRepo(connected.id);
    await expect(mockApi.getPet(connected.id)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects connecting the same repo twice', async () => {
    await mockApi.connectRepo('maia/twice');

    await expect(mockApi.connectRepo('maia/twice')).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a repo name in the wrong format', async () => {
    await expect(mockApi.connectRepo('not a repo')).rejects.toMatchObject({ status: 400 });
  });
});
