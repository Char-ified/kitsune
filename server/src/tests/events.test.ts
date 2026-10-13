import crypto from 'node:crypto';
import type { EventType } from '@kitsune/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import pool from '../db.js';

// Signs up a user and connects one repo. The agent remembers the login cookie.
const setUp = async (email = 'fox@example.com') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'hunter2!!' });
  const connect = await agent.post('/api/repos').send({ fullName: 'fox/den' });
  const repoId: number = connect.body.id;

  return {
    agent,
    repoId,
    secret: connect.body.webhookSecret as string,
    eventsUrl: `/api/repos/${repoId}/events`,
  };
};

// Adds an event row directly, dated some number of minutes before now.
const addEvent = async (repoId: number, type: EventType, minutesAgo: number, details = {}) => {
  await pool.query(
    `INSERT INTO events (repo_id, type, github_delivery_id, details, created_at)
     VALUES ($1, $2, gen_random_uuid()::text, $3, now() - make_interval(mins => $4))`,
    [repoId, type, JSON.stringify(details), minutesAgo],
  );
};

// Adds many events in one query: event 1 is the newest, event `count` the oldest.
const addManyEvents = async (repoId: number, count: number) => {
  await pool.query(
    `INSERT INTO events (repo_id, type, github_delivery_id, details, created_at)
     SELECT $1, 'pr_merged', gen_random_uuid()::text, jsonb_build_object('number', n),
            now() - make_interval(mins => n)
     FROM generate_series(1, $2::int) AS n`,
    [repoId, count],
  );
};

describe('GET /api/repos/:repoId/events', () => {
  it('returns an empty list for a repo with no events yet', async () => {
    const { agent, eventsUrl } = await setUp();

    const res = await agent.get(eventsUrl);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns an event saved by the webhook, in the contract shape', async () => {
    const { agent, repoId, secret, eventsUrl } = await setUp();
    const body = JSON.stringify({
      action: 'closed',
      pull_request: {
        number: 12,
        title: 'add login route',
        html_url: 'https://github.com/fox/den/pull/12',
        merged: true,
      },
    });
    await request(app)
      .post(`/api/webhooks/github/${repoId}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'delivery-1')
      .set(
        'X-Hub-Signature-256',
        `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`,
      )
      .send(body);

    const res = await agent.get(eventsUrl);

    expect(res.body).toEqual([
      {
        id: expect.any(Number),
        type: 'pr_merged',
        details: {
          number: 12,
          title: 'add login route',
          url: 'https://github.com/fox/den/pull/12',
        },
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      },
    ]);
  });

  it('returns {} for details when an event has nothing extra', async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    await addEvent(repoId, 'tests_passed', 1);

    const res = await agent.get(eventsUrl);

    expect(res.body[0].details).toEqual({});
  });

  it('lists events newest first', async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    await addEvent(repoId, 'tests_failed', 30);
    await addEvent(repoId, 'pr_merged', 10);
    await addEvent(repoId, 'tests_passed', 20);

    const res = await agent.get(eventsUrl);

    expect(res.body.map((event: { type: string }) => event.type)).toEqual([
      'pr_merged',
      'tests_passed',
      'tests_failed',
    ]);
  });

  it('returns the 20 newest events by default', async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    await addManyEvents(repoId, 25);

    const res = await agent.get(eventsUrl);

    expect(res.body).toHaveLength(20);
    expect(res.body[0].details.number).toBe(1);
    expect(res.body[19].details.number).toBe(20);
  });

  it('returns only as many as ?limit= asks for', async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    await addManyEvents(repoId, 25);

    const res = await agent.get(`${eventsUrl}?limit=5`);

    expect(res.body.map((event: { details: { number: number } }) => event.details.number)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it.each(['abc', '0', '-3', '2.5', ''])(
    'falls back to the default when limit is "%s"',
    async (limit) => {
      const { agent, repoId, eventsUrl } = await setUp();
      await addManyEvents(repoId, 25);

      const res = await agent.get(`${eventsUrl}?limit=${limit}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(20);
    },
  );

  it('never returns more than 100, however large the limit', async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    await addManyEvents(repoId, 105);

    const res = await agent.get(`${eventsUrl}?limit=5000`);

    expect(res.body).toHaveLength(100);
  });

  it("only returns this repo's events", async () => {
    const { agent, repoId, eventsUrl } = await setUp();
    const second = await agent.post('/api/repos').send({ fullName: 'fox/second-den' });
    await addEvent(repoId, 'pr_merged', 1);
    await addEvent(second.body.id, 'tests_failed', 1);

    const res = await agent.get(eventsUrl);

    expect(res.body.map((event: { type: string }) => event.type)).toEqual(['pr_merged']);
  });
});

describe('who can reach the event log', () => {
  it('rejects a visitor who is not logged in', async () => {
    const { eventsUrl } = await setUp();

    const res = await request(app).get(eventsUrl);

    expect(res.status).toBe(401);
  });

  it("hides another user's repo behind the same 404 as a missing one", async () => {
    const owner = await setUp('owner@example.com');
    await addEvent(owner.repoId, 'pr_merged', 1);
    const stranger = await setUp('stranger@example.com');

    const res = await stranger.agent.get(owner.eventsUrl);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Repo not found' });
  });

  it('returns 404 for a repo that does not exist', async () => {
    const { agent } = await setUp();

    const res = await agent.get('/api/repos/999999/events');

    expect(res.status).toBe(404);
  });
});
