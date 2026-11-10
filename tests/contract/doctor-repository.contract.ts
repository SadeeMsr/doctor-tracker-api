import { beforeEach, describe, expect, it } from 'vitest';

import type {
  DoctorListCriteria,
  DoctorRepository,
} from '../../src/domain/doctor/doctor.repository.js';
import { ConflictError } from '../../src/domain/shared/errors.js';
import { aDoctor } from '../support/fixtures.js';

const byNewest: DoctorListCriteria = { sortBy: 'createdAt', sortOrder: 'desc' };
const firstPage = { page: 1, limit: 10 };

/**
 * Behaviour every DoctorRepository adapter must satisfy. Run against the in-memory fake and
 * against MongoDB, so the fake used in unit tests can never lie.
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

    it('treats malformed ids as "not found" instead of throwing', async () => {
      const created = await repo.create(aDoctor());

      await expect(repo.findById(created.id)).resolves.toMatchObject({ id: created.id });
      await expect(repo.findById('not-an-id')).resolves.toBeNull();
      await expect(repo.delete('not-an-id')).resolves.toBe(false);
    });

    it('rejects a duplicate email with a domain ConflictError', async () => {
      await repo.create(aDoctor({ email: 'same@example.com' }));

      await expect(repo.create(aDoctor({ email: 'same@example.com' }))).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('searches by case-insensitive prefix, escapes regex input, and filters', async () => {
      await repo.create(aDoctor({ name: 'Dr. Sarah Khan', specialization: 'Neurology' }));
      await repo.create(aDoctor({ name: 'Dr. Samir Das', specialization: 'Cardiology' }));

      const search = await repo.list({ ...byNewest, search: 'dr. sa' }, firstPage);
      const filtered = await repo.list(
        { ...byNewest, search: 'dr. sa', specialization: 'Neurology' },
        firstPage,
      );
      const regexInjection = await repo.list({ ...byNewest, search: '.*' }, firstPage);

      expect(search.total).toBe(2);
      expect(filtered.items.map((d) => d.name)).toEqual(['Dr. Sarah Khan']);
      expect(regexInjection.total).toBe(0);
    });

    it('paginates in a stable order with an accurate total', async () => {
      for (const name of ['Dr. C', 'Dr. A', 'Dr. E', 'Dr. B', 'Dr. D']) {
        await repo.create(aDoctor({ name }));
      }
      const byName: DoctorListCriteria = { sortBy: 'name', sortOrder: 'asc' };

      const page1 = await repo.list(byName, { page: 1, limit: 2 });
      const page3 = await repo.list(byName, { page: 3, limit: 2 });

      expect(page1).toMatchObject({ total: 5 });
      expect(page1.items.map((d) => d.name)).toEqual(['Dr. A', 'Dr. B']);
      expect(page3.items.map((d) => d.name)).toEqual(['Dr. E']);
    });
  });
}
