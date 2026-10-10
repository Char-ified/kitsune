import type { Pet, Repo, RepoEvent } from '@kitsune/shared';
import { ApiError, type Api } from './client';

// A fake API that lives in memory, shaped exactly like docs/API.md.
// It lets us build and click through pages before the real routes exist.
// Turn it on with VITE_USE_MOCKS=true in dashboard/.env.local. Data resets on refresh.

const now = () => new Date().toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

// A short delay, so loading states are visible like they would be with a real server.
const pause = () => new Promise((resolve) => setTimeout(resolve, 300));

type FakeRepo = { id: number; fullName: string; createdAt: string };

let nextId = 3;

const repos: FakeRepo[] = [
  { id: 1, fullName: 'Char-ified/kitsune', createdAt: minutesAgo(3000) },
  { id: 2, fullName: 'demo-lab/moonlit-api', createdAt: minutesAgo(1200) },
];

const pets = new Map<number, Pet>([
  [
    1,
    {
      id: 1,
      name: 'Kitsu',
      character: 'kitsune',
      mood: 'happy',
      createdAt: minutesAgo(2900),
      updatedAt: minutesAgo(2900),
    },
  ],
]);

const events = new Map<number, RepoEvent[]>([
  [
    1,
    [
      {
        id: 3,
        type: 'pr_merged',
        details: { number: 12, title: 'add login route', url: 'https://github.com' },
        createdAt: minutesAgo(8),
      },
      {
        id: 2,
        type: 'tests_passed',
        details: { name: 'CI', url: 'https://github.com' },
        createdAt: minutesAgo(35),
      },
      {
        id: 1,
        type: 'tests_failed',
        details: { name: 'CI', url: 'https://github.com' },
        createdAt: minutesAgo(52),
      },
    ],
  ],
]);

const findRepo = (repoId: number): FakeRepo => {
  const repo = repos.find((item) => item.id === repoId);
  if (!repo) throw new ApiError(404, 'Repo not found');
  return repo;
};

const webhookDetails = (repoId: number) => ({
  webhookUrl: `http://localhost:3000/api/webhooks/github/${repoId}`,
  webhookSecret: `fake_secret_${Math.random().toString(36).slice(2, 12)}`,
});

export const mockApi: Api = {
  getRepos: async () => {
    await pause();
    return repos.map((repo): Repo => {
      const pet = pets.get(repo.id);
      return {
        ...repo,
        hasPet: Boolean(pet),
        pet: pet ? { name: pet.name, character: pet.character, mood: pet.mood } : null,
      };
    });
  },

  connectRepo: async (fullName) => {
    await pause();
    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
      throw new ApiError(400, 'Use the format owner/repo-name');
    }
    if (repos.some((repo) => repo.fullName.toLowerCase() === fullName.toLowerCase())) {
      throw new ApiError(409, 'You already connected this repo');
    }
    const repo = { id: nextId++, fullName, createdAt: now() };
    repos.push(repo);
    return { ...repo, ...webhookDetails(repo.id) };
  },

  disconnectRepo: async (repoId) => {
    await pause();
    findRepo(repoId);
    repos.splice(
      repos.findIndex((repo) => repo.id === repoId),
      1,
    );
    pets.delete(repoId);
    events.delete(repoId);
    return { deleted: true };
  },

  newWebhookSecret: async (repoId) => {
    await pause();
    findRepo(repoId);
    return webhookDetails(repoId);
  },

  getPet: async (repoId) => {
    await pause();
    findRepo(repoId);
    const pet = pets.get(repoId);
    if (!pet) throw new ApiError(404, 'No pet yet');
    return pet;
  },

  createPet: async (repoId, input) => {
    await pause();
    findRepo(repoId);
    if (!input.name.trim()) throw new ApiError(400, 'Give your pet a name');
    if (pets.has(repoId)) throw new ApiError(409, 'This repo already has a pet');
    const pet: Pet = {
      id: nextId++,
      name: input.name.trim(),
      character: input.character,
      mood: 'normal',
      createdAt: now(),
      updatedAt: now(),
    };
    pets.set(repoId, pet);
    return pet;
  },

  updatePet: async (repoId, input) => {
    await pause();
    findRepo(repoId);
    const pet = pets.get(repoId);
    if (!pet) throw new ApiError(404, 'No pet yet');
    if (input.name !== undefined && !input.name.trim()) {
      throw new ApiError(400, 'Give your pet a name');
    }
    const updated: Pet = {
      ...pet,
      name: input.name?.trim() ?? pet.name,
      character: input.character ?? pet.character,
      updatedAt: now(),
    };
    pets.set(repoId, updated);
    return updated;
  },

  getEvents: async (repoId) => {
    await pause();
    findRepo(repoId);
    return events.get(repoId) ?? [];
  },
};
