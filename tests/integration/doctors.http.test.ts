import { beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../support/app.js';
import { buildInMemoryContainer } from '../support/in-memory-container.js';
import { signIn } from '../support/auth.js';
import { aDoctor } from '../support/fixtures.js';

// A fresh app per test: no state (rows, sessions, rate-limit counters) leaks between tests.
let container = buildInMemoryContainer();
let app = buildTestApp(container);
beforeEach(() => {
  container = buildInMemoryContainer();
  app = buildTestApp(container);
});

describe('Doctors HTTP API', () => {
  let agent: Awaited<ReturnType<typeof signIn>>['agent'];

  beforeEach(async () => {
    ({ agent } = await signIn(app, container.services));
  });

  it('creates a doctor and returns 201 with a Location header', async () => {
    const res = await agent.post('/api/v1/doctors').send(aDoctor({ name: 'Dr. Nadia Islam' }));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/doctors/${String(res.body.data.id)}`);
    expect(res.body.data).toMatchObject({ name: 'Dr. Nadia Islam', createdAt: expect.any(String) });
  });

  it('returns 422 with field details for invalid input', async () => {
    const res = await agent
      .post('/api/v1/doctors')
      .send({ ...aDoctor(), email: 'not-an-email', specialization: 'Astrology' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['email', 'specialization']),
    );
  });

  it('returns 409 for a duplicate email', async () => {
    await agent.post('/api/v1/doctors').send(aDoctor({ email: 'dup@example.com' }));
    const res = await agent.post('/api/v1/doctors').send(aDoctor({ email: 'DUP@example.com' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('lists with search, filters and pagination meta', async () => {
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

    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Dr. Kamal']);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });

  it('rejects an inverted date range', async () => {
    const res = await agent.get('/api/v1/doctors').query({ from: '2026-02-01', to: '2026-01-01' });

    expect(res.status).toBe(422);
  });

  it('updates, then deletes, then 404s', async () => {
    const created = await agent.post('/api/v1/doctors').send(aDoctor());
    const url = `/api/v1/doctors/${String(created.body.data.id)}`;

    const updated = await agent.patch(url).send({ hospital: 'Evercare Hospital' });
    expect(updated.body.data.hospital).toBe('Evercare Hospital');

    expect((await agent.delete(url)).status).toBe(204);
    expect((await agent.get(url)).status).toBe(404);
  });

  it('returns 404 (not 500) for a malformed id', async () => {
    const res = await agent.get('/api/v1/doctors/not-a-real-id');

    expect(res.status).toBe(404);
  });

  it('rejects an empty update body', async () => {
    const created = await agent.post('/api/v1/doctors').send(aDoctor());
    const res = await agent.patch(`/api/v1/doctors/${String(created.body.data.id)}`).send({});

    expect(res.status).toBe(422);
  });

  it('filters by several specializations and hospitals: any-of within, all-of across', async () => {
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ specialization: 'Cardiology', hospital: 'Square Hospital, Dhaka' }));
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ specialization: 'Oncology', hospital: 'United Hospital' }));
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ specialization: 'Oncology', hospital: 'Ibn Sina Hospital' }));
    await agent
      .post('/api/v1/doctors')
      .send(aDoctor({ specialization: 'Urology', hospital: 'United Hospital' }));

    const anySpec = await agent.get('/api/v1/doctors?specialization=Cardiology,Oncology');
    // Hospitals are repeated keys: a name may contain a comma.
    const both = await agent
      .get('/api/v1/doctors')
      .query('specialization=Cardiology&specialization=Oncology')
      .query({ hospital: ['Square Hospital, Dhaka', 'United Hospital'] });

    expect(anySpec.body.meta.total).toBe(3);
    expect(both.body.meta.total).toBe(2);
    expect(both.body.data.map((d: { hospital: string }) => d.hospital).sort()).toEqual([
      'Square Hospital, Dhaka',
      'United Hospital',
    ]);
  });

  it('rejects an unknown specialization in a list with the item path', async () => {
    const res = await agent.get('/api/v1/doctors?specialization=Cardiology,Magic');

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'specialization.1' })]);
  });
});
