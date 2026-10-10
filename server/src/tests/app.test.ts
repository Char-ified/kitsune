import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';

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
