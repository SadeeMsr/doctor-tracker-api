import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { DoctorService } from '../../src/application/doctors/doctor.service.js';
import { buildTestApp } from '../support/app.js';
import { InMemoryDoctorRepository } from '../support/in-memory-doctor.repository.js';

// The whole HTTP stack, backed by in-memory adapters: no database required.
const services = { doctors: new DoctorService(new InMemoryDoctorRepository()) };

describe('app', () => {
  it('reports degraded health when the database is down', async () => {
    const res = await request(buildTestApp(services, () => false)).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ data: { status: 'degraded', database: 'down' } });
  });

  it('returns a JSON 404 envelope with a request id for unknown routes', async () => {
    const res = await request(buildTestApp(services)).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildTestApp(services))
      .post('/api/v1/doctors')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('sets security headers', async () => {
    const res = await request(buildTestApp(services)).get('/api/v1/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
