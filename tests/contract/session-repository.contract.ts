import { beforeEach, describe, expect, it } from 'vitest';

import type { SessionRepository } from '../../src/domain/session/session.repository.js';

const USER = '0000000000000000000000aa';
const OTHER_USER = '0000000000000000000000bb';
const inAnHour = () => new Date(Date.now() + 3_600_000);

export function describeSessionRepositoryContract(
  name: string,
  makeRepository: () => SessionRepository,
) {
  describe(`SessionRepository contract: ${name}`, () => {
    let repo: SessionRepository;

    beforeEach(() => {
      repo = makeRepository();
    });

    it('creates a session and finds it by token hash', async () => {
      await repo.create({ userId: USER, tokenHash: 'h1', expiresAt: inAnHour() });

      await expect(repo.findByTokenHash('h1')).resolves.toMatchObject({
        userId: USER,
        revokedAt: null,
        revokedReason: null,
      });
      await expect(repo.findByTokenHash('unknown')).resolves.toBeNull();
    });

    it('revokes an active session exactly once', async () => {
      await repo.create({ userId: USER, tokenHash: 'h2', expiresAt: inAnHour() });

      const first = await repo.revokeIfActive('h2', new Date(), 'rotated');
      const second = await repo.revokeIfActive('h2', new Date(), 'rotated');

      expect(first).toMatchObject({ userId: USER });
      expect(second).toBeNull();
      await expect(repo.findByTokenHash('h2')).resolves.toMatchObject({
        revokedAt: expect.any(Date),
      });
    });

    it('lets only one of many concurrent revocations win (race-safe rotation)', async () => {
      await repo.create({ userId: USER, tokenHash: 'h3', expiresAt: inAnHour() });

      const results = await Promise.all(
        Array.from({ length: 10 }, () => repo.revokeIfActive('h3', new Date(), 'rotated')),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('does not revoke an expired session', async () => {
      await repo.create({ userId: USER, tokenHash: 'h4', expiresAt: new Date(Date.now() - 1000) });

      await expect(repo.revokeIfActive('h4', new Date(), 'rotated')).resolves.toBeNull();
    });

    it("revokes all of one user's sessions and nobody else's", async () => {
      await repo.create({ userId: USER, tokenHash: 'h5', expiresAt: inAnHour() });
      await repo.create({ userId: USER, tokenHash: 'h6', expiresAt: inAnHour() });
      await repo.create({ userId: OTHER_USER, tokenHash: 'h7', expiresAt: inAnHour() });

      await repo.revokeAllForUser(USER, new Date(), 'reuse-detected');

      await expect(repo.revokeIfActive('h5', new Date(), 'logout')).resolves.toBeNull();
      await expect(repo.revokeIfActive('h6', new Date(), 'logout')).resolves.toBeNull();
      await expect(repo.revokeIfActive('h7', new Date(), 'logout')).resolves.not.toBeNull();
      await expect(repo.findByTokenHash('h5')).resolves.toMatchObject({
        revokedReason: 'reuse-detected',
      });
    });
  });
}
