import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp } from '../support/app.js';
import { signIn } from '../support/auth.js';
import { aDoctor } from '../support/fixtures.js';
import { buildInMemoryContainer } from '../support/in-memory-container.js';

let container = buildInMemoryContainer();
let app = buildTestApp(container);

function aPatient(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Karim Uddin',
    dateOfBirth: '1980-05-04',
    gender: 'male',
    phone: '+8801711000000',
    condition: 'stable',
    diagnosis: 'Hypertension, controlled',
    ...overrides,
  };
}

describe('Patients HTTP API', () => {
  let agent: Awaited<ReturnType<typeof signIn>>['agent'];
  let doctorId: string;

  beforeEach(async () => {
    container = buildInMemoryContainer();
    app = buildTestApp(container);
    ({ agent } = await signIn(app, container.services));
    const doctor = await agent.post('/api/v1/doctors').send(aDoctor()).expect(201);
    doctorId = String(doctor.body.data.id);
  });

  const addPatient = (body: object, key: string = randomUUID()) =>
    agent.post(`/api/v1/doctors/${doctorId}/patients`).set('Idempotency-Key', key).send(body);

  it('adds a patient under a doctor, with computed age and the doctor summary', async () => {
    const res = await addPatient(aPatient());

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Karim Uddin',
      age: expect.any(Number),
      doctor: { id: doctorId },
    });
    const doctor = await agent.get(`/api/v1/doctors/${doctorId}`).expect(200);
    expect(doctor.body.data.patientCount).toBe(1);
  });

  it('requires an Idempotency-Key, since patients have no natural unique field', async () => {
    const res = await agent.post(`/api/v1/doctors/${doctorId}/patients`).send(aPatient());

    expect(res.status).toBe(400);
  });

  it('replays a retried create instead of adding a duplicate patient', async () => {
    const key = randomUUID();
    const first = await addPatient(aPatient(), key);
    const retry = await addPatient(aPatient(), key);

    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.data.id).toBe(first.body.data.id);
    const list = await agent.get('/api/v1/patients').expect(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('filters by several conditions at once', async () => {
    await addPatient(aPatient({ name: 'Critical One', condition: 'critical' }));
    await addPatient(aPatient({ name: 'Stable One', condition: 'stable' }));
    await addPatient(aPatient({ name: 'Recovering One', condition: 'recovering' }));

    const res = await agent.get('/api/v1/patients?condition=critical,recovering').expect(200);

    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((p: { condition: string }) => p.condition).sort()).toEqual([
      'critical',
      'recovering',
    ]);
  });

  it('edits a patient with PATCH and returns 422 with field paths for bad input', async () => {
    const created = await addPatient(aPatient());
    const id = String(created.body.data.id);

    const ok = await agent.patch(`/api/v1/patients/${id}`).send({ condition: 'critical' });
    const bad = await agent.patch(`/api/v1/patients/${id}`).send({ condition: 'unknown' });

    expect(ok.status).toBe(200);
    expect(ok.body.data.condition).toBe('critical');
    expect(bad.status).toBe(422);
    expect(bad.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'condition' })]),
    );
  });

  it("won't delete a doctor who still has patients (409 with the count)", async () => {
    await addPatient(aPatient());

    const res = await agent.delete(`/api/v1/doctors/${doctorId}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details).toMatchObject({ patientCount: 1 });
  });

  it("removes a patient from a doctor's list, but not another doctor's patient", async () => {
    const created = await addPatient(aPatient());
    const id = String(created.body.data.id);
    const other = await agent.post('/api/v1/doctors').send(aDoctor()).expect(201);

    await agent.delete(`/api/v1/doctors/${String(other.body.data.id)}/patients/${id}`).expect(404);
    await agent.delete(`/api/v1/doctors/${doctorId}/patients/${id}`).expect(204);
    await agent.get(`/api/v1/patients/${id}`).expect(404);
  });
});
