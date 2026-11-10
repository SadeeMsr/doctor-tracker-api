import { beforeEach, describe, expect, it } from 'vitest';

import type {
  DoctorListCriteria,
  DoctorRepository,
} from '../../src/domain/doctor/doctor.repository.js';
import { ConflictError } from '../../src/domain/shared/errors.js';
import { aDoctor } from '../support/fixtures.js';

const defaults: DoctorListCriteria = { sortBy: 'createdAt', sortOrder: 'desc' };
const firstPage = { page: 1, limit: 10 };

/**
 * Behaviour every DoctorRepository adapter must satisfy. Run against the in-memory fake
 * and against MongoDB, so the fake used in unit tests can never lie.
 */
export function describeDoctorRepositoryContract(
  name: string,
  makeRepository: () => DoctorRepository,
) {
  describe(`DoctorRepository contract: ${name}`, () => {
    let repo: DoctorRepository;

    beforeEach(() => {
      repo = makeRepository();
    });

    it('creates and finds a doctor by id', async () => {
      const created = await repo.create(aDoctor({ name: 'Dr. Ada Lovelace' }));

      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toBeInstanceOf(Date);
      await expect(repo.findById(created.id)).resolves.toMatchObject({ name: 'Dr. Ada Lovelace' });
    });

    it('returns null for unknown and malformed ids', async () => {
      await expect(repo.findById('000000000000000000000000')).resolves.toBeNull();
      await expect(repo.findById('not-an-id')).resolves.toBeNull();
      await expect(repo.update('not-an-id', { name: 'x' })).resolves.toBeNull();
      await expect(repo.delete('not-an-id')).resolves.toBe(false);
    });

    it('rejects a duplicate email with ConflictError', async () => {
      await repo.create(aDoctor({ email: 'same@example.com' }));

      await expect(repo.create(aDoctor({ email: 'same@example.com' }))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('searches by case-insensitive name or email prefix', async () => {
      await repo.create(aDoctor({ name: 'Dr. Sarah Khan', email: 'sarah@example.com' }));
      await repo.create(aDoctor({ name: 'Dr. Omar Faruk', email: 'omar@example.com' }));

      const byName = await repo.list({ ...defaults, search: 'dr. sar' }, firstPage);
      const byEmail = await repo.list({ ...defaults, search: 'OMAR@' }, firstPage);
      const regexChars = await repo.list({ ...defaults, search: '.*' }, firstPage);

      expect(byName.items.map((d) => d.name)).toEqual(['Dr. Sarah Khan']);
      expect(byEmail.items.map((d) => d.name)).toEqual(['Dr. Omar Faruk']);
      expect(regexChars.total).toBe(0);
    });

    it('filters by specialization, hospital and date range', async () => {
      await repo.create(aDoctor({ specialization: 'Neurology', hospital: 'Square Hospital' }));
      await repo.create(aDoctor({ specialization: 'Neurology', hospital: 'Labaid' }));
      await repo.create(aDoctor({ specialization: 'Pediatrics', hospital: 'Square Hospital' }));

      const neuro = await repo.list({ ...defaults, specialization: 'Neurology' }, firstPage);
      const neuroAtSquare = await repo.list(
        { ...defaults, specialization: 'Neurology', hospital: 'Square Hospital' },
        firstPage,
      );
      const future = await repo.list(
        { ...defaults, createdAt: { from: new Date(Date.now() + 60_000) } },
        firstPage,
      );
      const recent = await repo.list(
        { ...defaults, createdAt: { from: new Date(Date.now() - 60_000) } },
        firstPage,
      );

      expect(neuro.total).toBe(2);
      expect(neuroAtSquare.total).toBe(1);
      expect(future.total).toBe(0);
      expect(recent.total).toBe(3);
    });

    it('paginates with a stable order and an accurate total', async () => {
      for (const name of ['Dr. C', 'Dr. A', 'Dr. E', 'Dr. B', 'Dr. D']) {
        await repo.create(aDoctor({ name }));
      }
      const criteria: DoctorListCriteria = { sortBy: 'name', sortOrder: 'asc' };

      const page1 = await repo.list(criteria, { page: 1, limit: 2 });
      const page3 = await repo.list(criteria, { page: 3, limit: 2 });

      expect(page1).toMatchObject({ total: 5, page: 1, limit: 2 });
      expect(page1.items.map((d) => d.name)).toEqual(['Dr. A', 'Dr. B']);
      expect(page3.items.map((d) => d.name)).toEqual(['Dr. E']);
    });

    it('updates and deletes', async () => {
      const { id } = await repo.create(aDoctor());

      await expect(repo.update(id, { hospital: 'New Hospital' })).resolves.toMatchObject({
        hospital: 'New Hospital',
      });
      await expect(repo.delete(id)).resolves.toBe(true);
      await expect(repo.findById(id)).resolves.toBeNull();
    });

    it('lists distinct hospitals alphabetically', async () => {
      await repo.create(aDoctor({ hospital: 'Square Hospital' }));
      await repo.create(aDoctor({ hospital: 'Evercare' }));
      await repo.create(aDoctor({ hospital: 'Square Hospital' }));

      await expect(repo.listHospitals()).resolves.toEqual(['Evercare', 'Square Hospital']);
    });
  });
}
