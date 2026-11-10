import { beforeEach, describe, expect, it } from 'vitest';

import { buildContainer } from '../../src/container.js';
import { buildTestApp } from '../support/app.js';
import { signIn } from '../support/auth.js';
import { aDoctor } from '../support/fixtures.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();

const container = buildContainer();
const app = buildTestApp(container);

describe('Doctors HTTP API', () => {
  let agent: Awaited<ReturnType<typeof signIn>>['agent'];

  beforeEach(async () => {
    ({ agent } = await signIn(app, container.services));
  });

  it('creates a doctor: 201 with a Location header', async () => {
    const res = await agent.post('/api/v1/doctors').send(aDoctor({ name: 'Dr. Nadia Islam' }));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/doctors/${String(res.body.data.id)}`);
  });

  it('returns 422 with per-field details for invalid input', async () => {
    const res = await agent
      .post('/api/v1/doctors')
      .send({ ...aDoctor(), email: 'not-an-email', specialization: 'Astrology' });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['email', 'specialization']),
    );
  });

  it('returns 409 for a duplicate email, case-insensitively', async () => {
    await agent.post('/api/v1/doctors').send(aDoctor({ email: 'dup@example.com' }));
    const res = await agent.post('/api/v1/doctors').send(aDoctor({ email: 'DUP@example.com' }));

    expect(res.status).toBe(409);
  });

  it('lists with search, filter, sort and pagination meta', async () => {
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ name: 'Dr. Karim', specialization: 'Oncology' }));
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ name: 'Dr. Kamal', specialization: 'Oncology' }));
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ name: 'Dr. Rina', specialization: 'Urology' }));

    const res = await agent.get('/api/v1/doctors').query({
      search: 'dr. ka',
      specialization: 'Oncology',
      limit: 1,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Dr. Kamal']);
    expect(res.body.meta).toMatchObject({ total: 2, totalPages: 2, hasNextPage: true });
  });

  it('returns 404, not 500, for a malformed id', async () => {
    expect((await agent.get('/api/v1/doctors/not-a-real-id')).status).toBe(404);
  });
});
