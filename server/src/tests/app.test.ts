import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import pool from '../db.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown API routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('a request body that is not valid JSON', () => {
  it('returns a JSON 400 instead of crashing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": "fox@example.com", ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be valid JSON' });
  });
});

describe('an unexpected error inside a route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a JSON 500 and keeps the details out of the response', async () => {
    // Make the route's database query fail, as if the connection had dropped.
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db password is hunter2'));
    // The handler logs the real error for us to read; keep it out of the test output.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fox@example.com', password: 'hunter2!!' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Unexpected server error' });
    expect(res.text).not.toContain('hunter2');
    expect(logged).toHaveBeenCalled();
  });
});
