import express from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createErrorHandler } from '../../src/presentation/http/middleware/error-handler.js';
import { createIdempotencyMiddleware } from '../../src/presentation/http/middleware/idempotency.js';
import { buildTestApp } from '../support/app.js';
import { buildInMemoryContainer } from '../support/in-memory-container.js';
import { signIn } from '../support/auth.js';
import { aDoctor } from '../support/fixtures.js';
import { InMemoryIdempotencyStore } from '../support/in-memory-idempotency-store.js';

// A fresh app per test: no state (rows, sessions, rate-limit counters) leaks between tests.
let container = buildInMemoryContainer();
let app = buildTestApp(container);
beforeEach(() => {
  container = buildInMemoryContainer();
  app = buildTestApp(container);
});
const KEY = 'Idempotency-Key';

describe('Idempotency-Key on POST /doctors', () => {
  let agent: Awaited<ReturnType<typeof signIn>>['agent'];
  let userId: string;

  beforeEach(async () => {
    const session = await signIn(app, container.services);
    agent = session.agent;
    userId = session.user.id;
  });

  it('replays the original response for a retried request and creates only one doctor', async () => {
    const body = aDoctor();

    const first = await agent.post('/api/v1/doctors').set(KEY, 'key-1').send(body);
    const retry = await agent.post('/api/v1/doctors').set(KEY, 'key-1').send(body);
    const list = await agent.get('/api/v1/doctors');

    expect(first.status).toBe(201);
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.headers.location).toBe(first.headers.location);
    expect(retry.body).toEqual(first.body);
    expect(list.body.meta.total).toBe(1);
  });

  it('rejects the same key with a different body', async () => {
    await agent.post('/api/v1/doctors').set(KEY, 'key-2').send(aDoctor());
    const res = await agent.post('/api/v1/doctors').set(KEY, 'key-2').send(aDoctor());

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('returns 409 while the original request is still in flight', async () => {
    const store = new InMemoryIdempotencyStore();
    const inFlightApp = buildTestApp({ ...container, idempotencyStore: store });
    const inFlight = (await signIn(inFlightApp, container.services)).agent;
    const body = aDoctor();
    const { createHash } = await import('node:crypto');
    await store.claim(
      `${userId} POST /api/v1/doctors key-3`,
      createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    );

    const res = await inFlight.post('/api/v1/doctors').set(KEY, 'key-3').send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
  });

  it('replays a stored 4xx instead of re-running the request', async () => {
    const invalid = { ...aDoctor(), email: 'not-an-email' };

    await agent.post('/api/v1/doctors').set(KEY, 'key-4').send(invalid);
    const retry = await agent.post('/api/v1/doctors').set(KEY, 'key-4').send(invalid);

    expect(retry.status).toBe(422);
    expect(retry.headers['idempotent-replayed']).toBe('true');
  });

  it('rejects a malformed key', async () => {
    const res = await agent.post('/api/v1/doctors').set(KEY, 'has spaces').send(aDoctor());

    expect(res.status).toBe(400);
  });

  it('still works without a key on an optional endpoint', async () => {
    const res = await agent.post('/api/v1/doctors').send(aDoctor());

    expect(res.status).toBe(201);
  });
});

describe('idempotency middleware', () => {
  function appWith(handler: express.RequestHandler, store = new InMemoryIdempotencyStore()) {
    const mini = express();
    mini.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    mini.use(express.json());
    mini.post('/things', createIdempotencyMiddleware(store)({ required: true }), handler);
    mini.use(createErrorHandler({ exposeStack: false }));
    return mini;
  }

  it('rejects a missing key when required', async () => {
    const res = await request(appWith((_req, res) => res.status(201).json({ ok: true })))
      .post('/things')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Idempotency-Key/);
  });

  it('does not store a 5xx, so the same key can be retried', async () => {
    let calls = 0;
    const mini = appWith((_req, res) => {
      calls += 1;
      res.status(calls === 1 ? 500 : 201).json({ calls });
    });

    const first = await request(mini).post('/things').set(KEY, 'key-5').send({ a: 1 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const retry = await request(mini).post('/things').set(KEY, 'key-5').send({ a: 1 });

    expect(first.status).toBe(500);
    expect(retry.status).toBe(201);
    expect(calls).toBe(2);
  });
});
