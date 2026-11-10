import { describe, expect, it } from 'vitest';

import type { IdempotencyStore } from '../../src/application/ports/idempotency-store.js';

type StoreFactory = (options?: { lockTimeoutMs?: number }) => IdempotencyStore;

const response = {
  statusCode: 201,
  body: { data: { id: 'abc' } },
  location: '/api/v1/doctors/abc',
};

/** Behaviour every IdempotencyStore adapter must satisfy (in-memory fake and MongoDB). */
export function describeIdempotencyStoreContract(name: string, makeStore: StoreFactory) {
  describe(`IdempotencyStore contract: ${name}`, () => {
    it('claims a new key, then reports it as processing', async () => {
      const store = makeStore();

      await expect(store.claim('k1', 'hash-a')).resolves.toEqual({ status: 'claimed' });
      await expect(store.claim('k1', 'hash-a')).resolves.toEqual({
        status: 'processing',
        requestHash: 'hash-a',
      });
    });

    it('returns the stored response once completed', async () => {
      const store = makeStore();
      await store.claim('k2', 'hash-a');
      await store.complete('k2', response);

      await expect(store.claim('k2', 'hash-a')).resolves.toEqual({
        status: 'completed',
        requestHash: 'hash-a',
        response,
      });
    });

    it('reports the original hash so callers can detect a reused key', async () => {
      const store = makeStore();
      await store.claim('k3', 'hash-a');

      await expect(store.claim('k3', 'hash-b')).resolves.toMatchObject({ requestHash: 'hash-a' });
    });

    it('lets a released key be claimed again', async () => {
      const store = makeStore();
      await store.claim('k4', 'hash-a');
      await store.release('k4');

      await expect(store.claim('k4', 'hash-a')).resolves.toEqual({ status: 'claimed' });
    });

    it('never releases a completed response', async () => {
      const store = makeStore();
      await store.claim('k5', 'hash-a');
      await store.complete('k5', response);
      await store.release('k5');

      await expect(store.claim('k5', 'hash-a')).resolves.toMatchObject({ status: 'completed' });
    });

    it('grants exactly one of many concurrent claims', async () => {
      const store = makeStore();

      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.claim('k6', 'hash-a')),
      );

      expect(results.filter((result) => result.status === 'claimed')).toHaveLength(1);
    });

    it('lets an abandoned claim be taken over after the lock timeout', async () => {
      const store = makeStore({ lockTimeoutMs: 20 });
      await store.claim('k7', 'hash-a');
      await new Promise((resolve) => setTimeout(resolve, 40));

      await expect(store.claim('k7', 'hash-a')).resolves.toEqual({ status: 'claimed' });
    });
  });
}
