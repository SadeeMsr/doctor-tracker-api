import { beforeEach, describe, expect, it } from 'vitest';

import type { SessionRepository } from '../../src/domain/session/session.repository.js';

const USER = '0000000000000000000000aa';
const inAnHour = () => new Date(Date.now() + 3_600_000);

/** Behaviour every SessionRepository adapter must satisfy (in-memory fake and MongoDB). */
export function describeSessionRepositoryContract(
  name: string,
  makeRepository: () => SessionRepository,
) {
  describe(`SessionRepository contract: ${name}`, () => {
    let repo: SessionRepository;

    beforeEach(() => {
      repo = makeRepository();
    });

    it('lets exactly one of many concurrent revocations win (race-safe rotation)', async () => {
      await repo.create({ userId: USER, tokenHash: 'h1', expiresAt: inAnHour() });

      const results = await Promise.all(
        Array.from({ length: 10 }, () => repo.revokeIfActive('h1', new Date(), 'rotated')),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      await expect(repo.findByTokenHash('h1')).resolves.toMatchObject({ revokedReason: 'rotated' });
    });

    it('never revokes an expired session', async () => {
      await repo.create({ userId: USER, tokenHash: 'h2', expiresAt: new Date(Date.now() - 1000) });

      await expect(repo.revokeIfActive('h2', new Date(), 'rotated')).resolves.toBeNull();
    });
  });
}
