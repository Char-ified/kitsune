import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestLogger } from '../requestLogger.js';

// A tiny app of its own: the real one switches the logger off while tests run.
const app = express();
app.use('/api', requestLogger);
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true });
});
app.get('/page', (_req, res) => {
  res.send('a dashboard page');
});

const logLines = () => vi.mocked(console.log).mock.calls.map((call) => String(call[0]));

describe('requestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the method, path, status, and time of an API request', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/api/ping');

    expect(logLines()).toEqual([expect.stringMatching(/^GET \/api\/ping 200 \d+ms$/)]);
  });

  it('logs the status of a request that fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/api/missing');

    expect(logLines()).toEqual([expect.stringMatching(/^GET \/api\/missing 404 \d+ms$/)]);
  });

  it('leaves the query string out', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/api/ping?token=do-not-log-me');

    expect(logLines()[0]).not.toContain('do-not-log-me');
  });

  it('does not log requests outside /api', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/page');

    expect(logLines()).toEqual([]);
  });
});
