import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import pool from '../db.js';

const credentials = { email: 'fox@example.com', password: 'hunter2!!' };

// Signs up a user. Pass overrides to change the email or password.
const signUp = async (overrides = {}) => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ ...credentials, ...overrides });
  return res;
};

describe('POST /api/auth/signup', () => {
  it('creates a user, returns a token, and sets an httpOnly cookie', async () => {
    const res = await signUp();

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(Number), email: 'fox@example.com' });

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('token=');
    expect(cookie).toContain('HttpOnly');
  });

  it('stores a bcrypt hash, never the plain password', async () => {
    await signUp();

    const result = await pool.query('SELECT password_hash FROM users WHERE email = $1', [
      credentials.email,
    ]);
    const { password_hash: hash } = result.rows[0];

    expect(hash).not.toBe(credentials.password);
    expect(hash).toMatch(/^\$2b\$/);
  });

  it('never returns the password hash', async () => {
    const res = await signUp();

    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('rejects an email that is already registered, ignoring case', async () => {
    await signUp();
    const res = await signUp({ email: 'FOX@Example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered' });
  });

  it.each([
    ['a missing password', { password: undefined }],
    ['a password under 8 characters', { password: 'short' }],
    ['an email without @', { email: 'not-an-email' }],
    ['a password that is not a string', { password: 12345678 }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await signUp(overrides);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    await signUp();
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fox@example.com');
    expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await signUp();

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical responses, so nobody can tell which emails have accounts.
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the user when the cookie is sent (dashboard)', async () => {
    const agent = request.agent(app); // an agent remembers cookies, like a browser
    await agent.post('/api/auth/signup').send(credentials);

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fox@example.com');
  });

  it('returns the user when a Bearer token is sent (extension)', async () => {
    const { body } = await signUp();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('fox@example.com');
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rejects a made-up token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie, so /me stops working', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send(credentials);

    const logout = await agent.post('/api/auth/logout');
    const me = await agent.get('/api/auth/me');

    expect(logout.status).toBe(200);
    expect(me.status).toBe(401);
  });
});
