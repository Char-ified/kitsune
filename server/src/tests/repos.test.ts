import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import pool from '../db.js';

// Signs up a user. The agent remembers the login cookie, like a browser would.
const signUp = async (email = 'fox@example.com') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'hunter2!!' });
  return agent;
};

// Signs up a user and connects one repo through the real route.
const setUp = async (email = 'fox@example.com', fullName = 'fox/den') => {
  const agent = await signUp(email);
  const connect = await agent.post('/api/repos').send({ fullName });
  const repoId: number = connect.body.id;

  return { agent, repoId, webhookSecret: connect.body.webhookSecret as string };
};

const savedSecret = async (repoId: number): Promise<string | undefined> => {
  const result = await pool.query('SELECT webhook_secret FROM repos WHERE id = $1', [repoId]);
  return result.rows[0]?.webhook_secret;
};

describe('POST /api/repos', () => {
  it('connects the repo and returns it in the contract shape', async () => {
    const agent = await signUp();

    const res = await agent.post('/api/repos').send({ fullName: 'fox/den' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      fullName: 'fox/den',
      webhookUrl: `http://localhost:3000/api/webhooks/github/${res.body.id}`,
      webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/),
      createdAt: expect.any(String),
    });
  });

  it('saves the secret it returns', async () => {
    const { repoId, webhookSecret } = await setUp();

    expect(await savedSecret(repoId)).toBe(webhookSecret);
  });

  it('trims the name', async () => {
    const agent = await signUp();

    const res = await agent.post('/api/repos').send({ fullName: '  fox/den  ' });

    expect(res.body.fullName).toBe('fox/den');
  });

  it.each([
    ['a missing fullName', {}],
    ['a fullName that is not a string', { fullName: 42 }],
    ['a blank fullName', { fullName: '   ' }],
    ['a name with no slash', { fullName: 'den' }],
    ['a name with two slashes', { fullName: 'fox/den/extra' }],
    ['a name with a space inside', { fullName: 'fox/my den' }],
    ['a full GitHub URL', { fullName: 'https://github.com/fox/den' }],
  ])('rejects %s', async (_label, body) => {
    const agent = await signUp();

    const res = await agent.post('/api/repos').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Use the format owner/repo-name' });
  });

  it('rejects the same user connecting the same repo twice', async () => {
    const { agent } = await setUp();

    const res = await agent.post('/api/repos').send({ fullName: 'fox/den' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'You already connected this repo' });
  });

  it('lets different users connect the same repo, each with their own secret', async () => {
    const first = await setUp('first@example.com', 'team/project');
    const second = await setUp('second@example.com', 'team/project');

    expect(second.repoId).not.toBe(first.repoId);
    expect(second.webhookSecret).not.toBe(first.webhookSecret);
  });

  it('rejects a visitor who is not logged in', async () => {
    const res = await request(app).post('/api/repos').send({ fullName: 'fox/den' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/repos', () => {
  it('returns an empty list for a user with no repos', async () => {
    const agent = await signUp();

    const res = await agent.get('/api/repos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns a repo with no pet in the contract shape', async () => {
    const { agent, repoId } = await setUp();

    const res = await agent.get('/api/repos');

    expect(res.body).toEqual([
      {
        id: repoId,
        fullName: 'fox/den',
        hasPet: false,
        pet: null,
        createdAt: expect.any(String),
      },
    ]);
  });

  it("includes the pet's name, character, and mood once the repo has one", async () => {
    const { agent, repoId } = await setUp();
    await agent.post(`/api/repos/${repoId}/pet`).send({ name: 'Kitsu', character: 'kitsune' });

    const res = await agent.get('/api/repos');

    expect(res.body[0]).toMatchObject({
      hasPet: true,
      pet: { name: 'Kitsu', character: 'kitsune', mood: 'normal' },
    });
  });

  it('lists repos oldest first', async () => {
    const { agent } = await setUp('fox@example.com', 'fox/first');
    await agent.post('/api/repos').send({ fullName: 'fox/second' });

    const res = await agent.get('/api/repos');

    expect(res.body.map((repo: { fullName: string }) => repo.fullName)).toEqual([
      'fox/first',
      'fox/second',
    ]);
  });

  it("never includes another user's repos", async () => {
    await setUp('owner@example.com', 'owner/secret-project');
    const stranger = await signUp('stranger@example.com');

    const res = await stranger.get('/api/repos');

    expect(res.body).toEqual([]);
  });

  it('never returns the webhook secret', async () => {
    const { agent, webhookSecret } = await setUp();

    const res = await agent.get('/api/repos');

    expect(JSON.stringify(res.body)).not.toContain(webhookSecret);
  });

  it('rejects a visitor who is not logged in', async () => {
    const res = await request(app).get('/api/repos');

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/repos/:repoId', () => {
  it('disconnects the repo', async () => {
    const { agent, repoId } = await setUp();

    const res = await agent.delete(`/api/repos/${repoId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect((await agent.get('/api/repos')).body).toEqual([]);
  });

  it('deletes the pet along with the repo', async () => {
    const { agent, repoId } = await setUp();
    await agent.post(`/api/repos/${repoId}/pet`).send({ name: 'Kitsu', character: 'kitsune' });

    await agent.delete(`/api/repos/${repoId}`);

    const pets = await pool.query('SELECT id FROM pets WHERE repo_id = $1', [repoId]);
    expect(pets.rows).toEqual([]);
  });

  it("does not let a stranger disconnect someone else's repo", async () => {
    const owner = await setUp('owner@example.com');
    const stranger = await signUp('stranger@example.com');

    const res = await stranger.delete(`/api/repos/${owner.repoId}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Repo not found' });
    expect((await owner.agent.get('/api/repos')).body).toHaveLength(1);
  });

  it('returns 404 for a repo that does not exist', async () => {
    const agent = await signUp();

    const res = await agent.delete('/api/repos/999999');

    expect(res.status).toBe(404);
  });

  it('rejects a visitor who is not logged in', async () => {
    const { repoId } = await setUp();

    const res = await request(app).delete(`/api/repos/${repoId}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/repos/:repoId/webhook-secret', () => {
  it('returns the webhook URL and a new secret', async () => {
    const { agent, repoId, webhookSecret: oldSecret } = await setUp();

    const res = await agent.post(`/api/repos/${repoId}/webhook-secret`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      webhookUrl: `http://localhost:3000/api/webhooks/github/${repoId}`,
      webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(res.body.webhookSecret).not.toBe(oldSecret);
  });

  it('saves the new secret in place of the old one', async () => {
    const { agent, repoId } = await setUp();

    const res = await agent.post(`/api/repos/${repoId}/webhook-secret`);

    expect(await savedSecret(repoId)).toBe(res.body.webhookSecret);
  });

  it("does not let a stranger replace someone else's secret", async () => {
    const owner = await setUp('owner@example.com');
    const stranger = await signUp('stranger@example.com');

    const res = await stranger.post(`/api/repos/${owner.repoId}/webhook-secret`);

    expect(res.status).toBe(404);
    expect(await savedSecret(owner.repoId)).toBe(owner.webhookSecret);
  });

  it('rejects a visitor who is not logged in', async () => {
    const { repoId } = await setUp();

    const res = await request(app).post(`/api/repos/${repoId}/webhook-secret`);

    expect(res.status).toBe(401);
  });
});
