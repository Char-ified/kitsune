import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import pool from '../db.js';

// Signs up a user and gives them one connected repo.
// The agent remembers the login cookie, like a browser would.
const setUp = async (email = 'fox@example.com') => {
  const agent = request.agent(app);
  const signup = await agent.post('/api/auth/signup').send({ email, password: 'hunter2!!' });

  // There is no connect-repo route yet (CHA-47), so the repo row is added directly.
  const result = await pool.query(
    'INSERT INTO repos (user_id, full_name, webhook_secret) VALUES ($1, $2, $3) RETURNING id',
    [signup.body.user.id, 'fox/den', 'test-secret'],
  );
  const repoId: number = result.rows[0].id;

  return { agent, repoId, petUrl: `/api/repos/${repoId}/pet` };
};

const kitsu = { name: 'Kitsu', character: 'kitsune' };

describe('POST /api/repos/:repoId/pet', () => {
  it('creates the pet and returns it in the contract shape', async () => {
    const { agent, petUrl } = await setUp();

    const res = await agent.post(petUrl).send(kitsu);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Kitsu',
      character: 'kitsune',
      mood: 'normal',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('trims the name', async () => {
    const { agent, petUrl } = await setUp();

    const res = await agent.post(petUrl).send({ ...kitsu, name: '  Kitsu  ' });

    expect(res.body.name).toBe('Kitsu');
  });

  it.each([
    ['a missing name', { name: undefined }],
    ['a blank name', { name: '   ' }],
    ['a name that is not a string', { name: 42 }],
    ['a name over 30 characters', { name: 'k'.repeat(31) }],
    ['a character we do not support', { character: 'dragon' }],
    ['a missing character', { character: undefined }],
  ])('rejects %s', async (_label, overrides) => {
    const { agent, petUrl } = await setUp();

    const res = await agent.post(petUrl).send({ ...kitsu, ...overrides });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('rejects a second pet for the same repo', async () => {
    const { agent, petUrl } = await setUp();
    await agent.post(petUrl).send(kitsu);

    const res = await agent.post(petUrl).send({ ...kitsu, name: 'Second' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This repo already has a pet' });
  });
});

describe('GET /api/repos/:repoId/pet', () => {
  it('returns the pet', async () => {
    const { agent, petUrl } = await setUp();
    await agent.post(petUrl).send(kitsu);

    const res = await agent.get(petUrl);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Kitsu', character: 'kitsune', mood: 'normal' });
  });

  it('says "No pet yet" when the repo has no pet', async () => {
    const { agent, petUrl } = await setUp();

    const res = await agent.get(petUrl);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No pet yet' });
  });
});

describe('PATCH /api/repos/:repoId/pet', () => {
  it('renames the pet and leaves the character alone', async () => {
    const { agent, petUrl } = await setUp();
    await agent.post(petUrl).send(kitsu);

    const res = await agent.patch(petUrl).send({ name: 'Mochi' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Mochi', character: 'kitsune' });
  });

  it('saves the change', async () => {
    const { agent, petUrl } = await setUp();
    await agent.post(petUrl).send(kitsu);
    await agent.patch(petUrl).send({ name: 'Mochi' });

    const res = await agent.get(petUrl);

    expect(res.body.name).toBe('Mochi');
  });

  it.each([
    ['nothing to update', {}],
    ['a blank name', { name: '' }],
    ['a character we do not support', { character: 'dragon' }],
  ])('rejects %s', async (_label, body) => {
    const { agent, petUrl } = await setUp();
    await agent.post(petUrl).send(kitsu);

    const res = await agent.patch(petUrl).send(body);

    expect(res.status).toBe(400);
  });

  it('returns 404 when there is no pet to update', async () => {
    const { agent, petUrl } = await setUp();

    const res = await agent.patch(petUrl).send({ name: 'Mochi' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No pet yet' });
  });
});

// The same rules guard all three routes, so GET stands in for them.
describe('who can reach the pet routes', () => {
  it('rejects a visitor who is not logged in', async () => {
    const { petUrl } = await setUp();

    const res = await request(app).get(petUrl);

    expect(res.status).toBe(401);
  });

  it("hides another user's repo behind the same 404 as a missing one", async () => {
    const owner = await setUp('owner@example.com');
    await owner.agent.post(owner.petUrl).send(kitsu);
    const stranger = await setUp('stranger@example.com');

    const res = await stranger.agent.get(owner.petUrl);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Repo not found' });
  });

  it("does not let a stranger rename someone else's pet", async () => {
    const owner = await setUp('owner@example.com');
    await owner.agent.post(owner.petUrl).send(kitsu);
    const stranger = await setUp('stranger@example.com');

    await stranger.agent.patch(owner.petUrl).send({ name: 'Stolen' });

    const res = await owner.agent.get(owner.petUrl);
    expect(res.body.name).toBe('Kitsu');
  });

  it('returns 404 for a repo id that is not a number', async () => {
    const { agent } = await setUp();

    const res = await agent.get('/api/repos/banana/pet');

    expect(res.status).toBe(404);
  });
});
