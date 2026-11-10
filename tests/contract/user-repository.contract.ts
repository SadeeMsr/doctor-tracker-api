import { beforeEach, describe, expect, it } from 'vitest';

import type { NewUser } from '../../src/domain/user/user.entity.js';
import type { UserRepository } from '../../src/domain/user/user.repository.js';

const admin: NewUser = {
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  passwordHash: 'hash-1',
};

export function describeUserRepositoryContract(name: string, makeRepository: () => UserRepository) {
  describe(`UserRepository contract: ${name}`, () => {
    let repo: UserRepository;

    beforeEach(() => {
      repo = makeRepository();
    });

    it('creates a user on first upsert and finds it by email and id', async () => {
      const created = await repo.upsertByEmail(admin);

      await expect(repo.findByEmail('admin@example.com')).resolves.toMatchObject({
        id: created.id,
      });
      await expect(repo.findById(created.id)).resolves.toMatchObject({
        email: 'admin@example.com',
      });
    });

    it('updates the same user on repeated upserts (idempotent provisioning)', async () => {
      const first = await repo.upsertByEmail(admin);
      const second = await repo.upsertByEmail({
        ...admin,
        name: 'Renamed',
        passwordHash: 'hash-2',
      });

      expect(second.id).toBe(first.id);
      expect(second).toMatchObject({ name: 'Renamed', passwordHash: 'hash-2' });
    });

    it('returns null for unknown emails and malformed ids', async () => {
      await expect(repo.findByEmail('nobody@example.com')).resolves.toBeNull();
      await expect(repo.findById('not-an-id')).resolves.toBeNull();
      await expect(repo.findById('000000000000000000000000')).resolves.toBeNull();
    });
  });
}
