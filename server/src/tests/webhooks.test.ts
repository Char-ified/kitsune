import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import { isValidSignature, signPayload } from '../webhooks/signature.js';

// Signs up a user and connects one repo, like the dashboard would.
const setUp = async (email = 'fox@example.com') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'hunter2!!' });
  const connect = await agent.post('/api/repos').send({ fullName: 'fox/den' });
  const repoId: number = connect.body.id;

  return {
    agent,
    repoId,
    secret: connect.body.webhookSecret as string,
    webhookUrl: `/api/webhooks/github/${repoId}`,
  };
};

// Signs a body the way GitHub does. Written out here, not imported from the server code,
// so the tests would catch a mistake in the server's own signing.
const githubSignature = (body: string, secret: string): string =>
  `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

// Sends a delivery the way GitHub does: no login cookie, a JSON body, a signature header.
const deliver = (url: string, body: string, signature?: string) => {
  const req = request(app)
    .post(url)
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', 'ping')
    .set('X-GitHub-Delivery', crypto.randomUUID());
  if (signature !== undefined) req.set('X-Hub-Signature-256', signature);
  return req.send(body);
};

const ping = JSON.stringify({ zen: 'Keep it logically awesome.', hook_id: 1 });

describe('POST /api/webhooks/github/:repoId', () => {
  it('accepts a delivery signed with the repo secret', async () => {
    const { webhookUrl, secret } = await setUp();

    const res = await deliver(webhookUrl, ping, githubSignature(ping, secret));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('rejects a delivery with no signature', async () => {
    const { webhookUrl } = await setUp();

    const res = await deliver(webhookUrl, ping);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid signature' });
  });

  it('rejects a delivery signed with the wrong secret', async () => {
    const { webhookUrl } = await setUp();

    const res = await deliver(webhookUrl, ping, githubSignature(ping, 'not-the-secret'));

    expect(res.status).toBe(401);
  });

  it('rejects a body that was changed after it was signed', async () => {
    const { webhookUrl, secret } = await setUp();
    const tampered = JSON.stringify({ zen: 'Trust me.', hook_id: 1 });

    const res = await deliver(webhookUrl, tampered, githubSignature(ping, secret));

    expect(res.status).toBe(401);
  });

  it('checks the signature against the exact bytes sent, not re-serialized JSON', async () => {
    const { webhookUrl, secret } = await setUp();
    // Same data as `ping`, but with spacing that JSON.parse + JSON.stringify would lose.
    const spaced = '{ "zen" : "Keep it logically awesome.",\n  "hook_id" : 1 }';

    const res = await deliver(webhookUrl, spaced, githubSignature(spaced, secret));

    expect(res.status).toBe(200);
  });

  it("rejects a delivery signed with a different repo's secret", async () => {
    const mine = await setUp('mine@example.com');
    const theirs = await setUp('theirs@example.com');

    const res = await deliver(mine.webhookUrl, ping, githubSignature(ping, theirs.secret));

    expect(res.status).toBe(401);
  });

  it('stops accepting the old secret once a new one is generated', async () => {
    const { agent, repoId, webhookUrl, secret: oldSecret } = await setUp();
    const renewed = await agent.post(`/api/repos/${repoId}/webhook-secret`);
    const newSecret: string = renewed.body.webhookSecret;

    const withOld = await deliver(webhookUrl, ping, githubSignature(ping, oldSecret));
    const withNew = await deliver(webhookUrl, ping, githubSignature(ping, newSecret));

    expect(withOld.status).toBe(401);
    expect(withNew.status).toBe(200);
  });

  it.each([
    ['an ID no repo has', '999999'],
    ['an ID that is not a number', 'banana'],
    ['an ID too large to be real', '99999999999999999999'],
  ])('returns 404 for %s', async (_label, id) => {
    const res = await deliver(`/api/webhooks/github/${id}`, ping, githubSignature(ping, 'x'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Repo not found' });
  });

  it('leaves JSON parsing working for the other routes', async () => {
    const { agent } = await setUp();

    const res = await agent.post('/api/repos').send({ fullName: 'fox/second-den' });

    expect(res.status).toBe(201);
  });
});

describe('signature helpers', () => {
  // The example from GitHub's "Validating webhook deliveries" docs.
  const secret = "It's a Secret to Everybody";
  const body = Buffer.from('Hello, World!');
  const expected = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';

  it("produces the same signature as GitHub's documented example", () => {
    expect(signPayload(body, secret)).toBe(expected);
  });

  it('accepts the documented signature and rejects anything else', () => {
    expect(isValidSignature(body, secret, expected)).toBe(true);
    expect(isValidSignature(body, secret, expected.replace(/7$/, '8'))).toBe(false);
    expect(isValidSignature(body, secret, 'sha256=short')).toBe(false);
    expect(isValidSignature(body, secret, undefined)).toBe(false);
  });
});
