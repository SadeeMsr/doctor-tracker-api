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
const refreshWith = (token: string | undefined) =>
  request(app)
    .post('/api/v1/auth/refresh')
    .set('Cookie', `dt_refresh=${String(token)}`);

describe('Auth HTTP API', () => {
  beforeEach(async () => {
    await container.services.users.provisionAccount(TEST_ADMIN);
  });

  it('logs in with httpOnly SameSite cookies and never returns the password hash', async () => {
    const res = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const cookies = parseSetCookies(res.headers['set-cookie']);

    expect(res.status).toBe(200);
    expect(res.body.data.passwordHash).toBeUndefined();
    for (const name of ['dt_access', 'dt_refresh']) {
      expect(cookies[name]?.attributes).toEqual(
        expect.arrayContaining(['httponly', 'samesite=lax']),
      );
    }
  });

  it('protects routes: 401 without a session, 200 with one', async () => {
    expect((await request(app).get('/api/v1/doctors')).status).toBe(401);

    const { agent } = await signIn(app, container.services);
    expect((await agent.get('/api/v1/doctors')).status).toBe(200);
  });

  it('detects refresh-token theft: reuse after rotation kills every session and clears cookies', async () => {
    const first = await login({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const stolen = parseSetCookies(first.headers['set-cookie']).dt_refresh?.value;
    const rotated = await refreshWith(stolen);
    const current = parseSetCookies(rotated.headers['set-cookie']).dt_refresh?.value;
    // Pretend the rotation happened a minute ago, outside the 10 s grace window.
    await SessionModel.updateMany(
      { revokedReason: 'rotated' },
      { $set: { revokedAt: new Date(Date.now() - 60_000) } },
    );

    const reuse = await refreshWith(stolen);

    expect(rotated.status).toBe(204);
    expect(reuse.status).toBe(401);
    expect(parseSetCookies(reuse.headers['set-cookie']).dt_refresh?.attributes).toEqual(
      expect.arrayContaining([expect.stringMatching(/^expires=thu, 01 jan 1970/)]),
    );
    expect((await refreshWith(current)).status).toBe(401);
  });

  it('logs out idempotently', async () => {
    const { agent } = await signIn(app, container.services);

    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/v1/doctors')).status).toBe(401);
  });

  it('rate-limits failed logins with 429', async () => {
    const freshApp = buildTestApp(container); // its own limiter: earlier tests don't count
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const res = await request(freshApp)
        .post('/api/v1/auth/login')
        .send({ email: 'brute@test.dev', password: `guess-${String(attempt)}` });
      statuses.push(res.status);
    }

    expect(statuses.at(-2)).toBe(401);
    expect(statuses.at(-1)).toBe(429);
  });
});
