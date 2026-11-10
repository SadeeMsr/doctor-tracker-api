import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildContainer } from '../../src/container.js';
import { SessionModel } from '../../src/infrastructure/database/mongoose/models/session.model.js';
import { buildTestApp } from '../support/app.js';
import { parseSetCookies, signIn, TEST_ADMIN } from '../support/auth.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();

const container = buildContainer();
const app = buildTestApp(container);
const login = (body: object) => request(app).post('/api/v1/auth/login').send(body);

describe('Auth HTTP API', () => {
  beforeEach(async () => {
    await container.services.users.provisionAccount(TEST_ADMIN);
  });

  describe('POST /auth/login', () => {
    it('sets httpOnly, SameSite=Lax cookies and returns the user without its hash', async () => {
      const res = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
      const cookies = parseSetCookies(res.headers['set-cookie']);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ email: TEST_ADMIN.email, role: 'admin' });
      expect(res.body.data.passwordHash).toBeUndefined();
      for (const name of ['dt_access', 'dt_refresh']) {
        expect(cookies[name]?.attributes).toEqual(
          expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']),
        );
      }
    });

    it('returns one generic 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ email: TEST_ADMIN.email, password: 'nope' });
      const unknownEmail = await login({ email: 'ghost@test.dev', password: 'nope' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('validates the body', async () => {
      const res = await login({ email: 'not-an-email' });

      expect(res.status).toBe(422);
      expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
        expect.arrayContaining(['email', 'password']),
      );
    });
  });

  describe('protected routes', () => {
    it('rejects requests without a session', async () => {
      const doctors = await request(app).get('/api/v1/doctors');
      const me = await request(app).get('/api/v1/auth/me');

      expect(doctors.status).toBe(401);
      expect(doctors.body.error.code).toBe('UNAUTHORIZED');
      expect(me.status).toBe(401);
    });

    it('rejects a forged access token', async () => {
      const res = await request(app)
        .get('/api/v1/doctors')
        .set('Cookie', 'dt_access=forged.jwt.value');

      expect(res.status).toBe(401);
    });

    it('serves /me and protected routes with a session', async () => {
      const { agent } = await signIn(app, container.services);

      expect((await agent.get('/api/v1/auth/me')).body.data.email).toBe(TEST_ADMIN.email);
      expect((await agent.get('/api/v1/doctors')).status).toBe(200);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh cookie', async () => {
      const first = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
      const oldRefresh = parseSetCookies(first.headers['set-cookie']).dt_refresh?.value;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `dt_refresh=${String(oldRefresh)}`);
      const newRefresh = parseSetCookies(res.headers['set-cookie']).dt_refresh?.value;

      expect(res.status).toBe(204);
      expect(newRefresh).toBeTruthy();
      expect(newRefresh).not.toBe(oldRefresh);
    });

    it('answers a concurrent duplicate refresh with 204 and no new cookies', async () => {
      const first = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
      const cookie = `dt_refresh=${String(parseSetCookies(first.headers['set-cookie']).dt_refresh?.value)}`;

      await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
      const duplicate = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

      expect(duplicate.status).toBe(204);
      expect(duplicate.headers['set-cookie']).toBeUndefined();
    });

    it('kills every session and clears cookies when a stale token is reused', async () => {
      const first = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
      const stale = `dt_refresh=${String(parseSetCookies(first.headers['set-cookie']).dt_refresh?.value)}`;
      const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', stale);
      const current = `dt_refresh=${String(parseSetCookies(rotated.headers['set-cookie']).dt_refresh?.value)}`;
      // Pretend the rotation happened a minute ago (outside the grace window).
      await SessionModel.updateMany(
        { revokedAt: { $ne: null } },
        { $set: { revokedAt: new Date(Date.now() - 60_000) } },
      );

      const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', stale);
      const afterwards = await request(app).post('/api/v1/auth/refresh').set('Cookie', current);

      expect(reuse.status).toBe(401);
      expect(parseSetCookies(reuse.headers['set-cookie']).dt_refresh?.attributes).toEqual(
        expect.arrayContaining([expect.stringMatching(/^expires=thu, 01 jan 1970/)]),
      );
      expect(afterwards.status).toBe(401);
    });

    it('returns 401 without a refresh cookie', async () => {
      expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears cookies, ends the session, and is idempotent', async () => {
      const { agent } = await signIn(app, container.services);

      const first = await agent.post('/api/v1/auth/logout');
      const again = await agent.post('/api/v1/auth/logout');
      const anonymous = await request(app).post('/api/v1/auth/logout');

      expect([first.status, again.status, anonymous.status]).toEqual([204, 204, 204]);
      expect((await agent.get('/api/v1/doctors')).status).toBe(401);
    });
  });

  describe('rate limiting', () => {
    it('blocks repeated failed logins with 429', async () => {
      const freshApp = buildTestApp(container); // its own limiter: earlier tests don't count
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const res = await request(freshApp)
          .post('/api/v1/auth/login')
          .send({ email: 'brute@test.dev', password: `guess-${String(attempt)}` });
        statuses.push(res.status);
      }

      expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
    });
  });
});
