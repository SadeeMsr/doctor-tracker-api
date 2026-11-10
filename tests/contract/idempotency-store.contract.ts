import { describe, expect, it } from 'vitest';

import type { IdempotencyStore } from '../../src/application/ports/idempotency-store.js';

const response = {
  statusCode: 201,
  body: { data: { id: 'abc' } },
  location: '/api/v1/doctors/abc',
};

/** Behaviour every IdempotencyStore adapter must satisfy (in-memory fake and MongoDB). */
export function describeIdempotencyStoreContract(name: string, makeStore: () => IdempotencyStore) {
  describe(`IdempotencyStore contract: ${name}`, () => {
    it('grants exactly one of many concurrent claims', async () => {
      const store = makeStore();

      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.claim('k1', 'hash')),
      );

      expect(results.filter((result) => result.status === 'claimed')).toHaveLength(1);
    });

    it('replays the stored response once completed', async () => {
      const store = makeStore();
      await store.claim('k2', 'hash');
      await store.complete('k2', response);

      await expect(store.claim('k2', 'hash')).resolves.toEqual({
        status: 'completed',
        requestHash: 'hash',
        response,
      });
    });
  });
}
