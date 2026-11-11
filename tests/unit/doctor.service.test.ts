import { beforeEach, describe, expect, it } from 'vitest';

import { DoctorService } from '../../src/application/doctors/doctor.service.js';
import { NotFoundError } from '../../src/domain/shared/errors.js';
import { aDoctor } from '../support/fixtures.js';
import { InMemoryDoctorRepository } from '../support/in-memory-doctor.repository.js';
import { InMemoryPatientRepository } from '../support/in-memory-patient.repository.js';

/** Pure use-case tests: no database, no HTTP. */
describe('DoctorService', () => {
  let service: DoctorService;

  beforeEach(() => {
    const doctors = new InMemoryDoctorRepository();
    service = new DoctorService(doctors, new InMemoryPatientRepository(doctors));
  });

  it('normalizes input before persisting', async () => {
    const doctor = await service.create(
      aDoctor({ name: '  Dr. Rahim  ', email: ' Rahim@Example.COM ' }),
    );

    expect(doctor).toMatchObject({ name: 'Dr. Rahim', email: 'rahim@example.com' });
  });

  it('throws NotFoundError for a missing doctor', async () => {
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('treats a blank search as no search', async () => {
    await service.create(aDoctor());
    await service.create(aDoctor());

    const result = await service.list(
      { search: '   ', sortBy: 'createdAt', sortOrder: 'desc' },
      { page: 1, limit: 10 },
    );

    expect(result.total).toBe(2);
  });
});
