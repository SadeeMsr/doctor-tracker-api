import { beforeEach, describe, expect, it } from 'vitest';

import { buildContainer } from '../../src/container.js';
import { buildTestApp } from '../support/app.js';
import { signIn } from '../support/auth.js';
import { aDoctor } from '../support/fixtures.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();

const container = buildContainer();
const app = buildTestApp(container);
const KEY = 'Idempotency-Key';

describe('Idempotency-Key on POST /doctors', () => {
  let agent: Awaited<ReturnType<typeof signIn>>['agent'];

  beforeEach(async () => {
    ({ agent } = await signIn(app, container.services));
  });

  it('replays the original response for a retry and creates only one doctor', async () => {
    const body = aDoctor();

    const first = await agent.post('/api/v1/doctors').set(KEY, 'key-1').send(body);
    const retry = await agent.post('/api/v1/doctors').set(KEY, 'key-1').send(body);

    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body).toEqual(first.body);
    expect((await agent.get('/api/v1/doctors')).body.meta.total).toBe(1);
  });

  it('rejects the same key with a different body', async () => {
    await agent.post('/api/v1/doctors').set(KEY, 'key-2').send(aDoctor());
    const res = await agent.post('/api/v1/doctors').set(KEY, 'key-2').send(aDoctor());

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});
