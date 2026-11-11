import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../support/app.js';
import { buildInMemoryContainer } from '../support/in-memory-container.js';

// The whole HTTP stack, backed by in-memory adapters: no database required.
const { services } = buildInMemoryContainer();

describe('app', () => {
  it('reports degraded health when the database is down', async () => {
    const res = await request(buildTestApp({ services, isDatabaseHealthy: () => false })).get(
      '/api/v1/health',
    );

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ data: { status: 'degraded', database: 'down' } });
  });

  it('returns a JSON 404 envelope with a request id for unknown routes', async () => {
    const res = await request(buildTestApp({ services })).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildTestApp({ services }))
      .post('/api/v1/doctors')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('sets security headers', async () => {
    const res = await request(buildTestApp({ services })).get('/api/v1/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
