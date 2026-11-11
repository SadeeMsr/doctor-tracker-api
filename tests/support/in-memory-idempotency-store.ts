import type {
  IdempotencyClaim,
  IdempotencyStore,
  StoredResponse,
} from '../../src/application/ports/idempotency-store.js';

interface Entry {
  requestHash: string;
  createdAt: number;
  response?: StoredResponse;
}

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

/** Test double for IdempotencyStore; satisfies the same contract as the Mongo adapter. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #entries = new Map<string, Entry>();
  readonly #lockTimeoutMs: number;

  constructor({ lockTimeoutMs = 60_000 }: { lockTimeoutMs?: number } = {}) {
    this.#lockTimeoutMs = lockTimeoutMs;
  }

  async claim(key: string, requestHash: string): Promise<IdempotencyClaim> {
    const existing = this.#entries.get(key);
    const abandoned =
      existing && !existing.response && Date.now() - existing.createdAt > this.#lockTimeoutMs;

    if (!existing || abandoned) {
      this.#entries.set(key, { requestHash, createdAt: Date.now() });
      return { status: 'claimed' };
    }
    return existing.response
      ? { status: 'completed', requestHash: existing.requestHash, response: existing.response }
      : { status: 'processing', requestHash: existing.requestHash };
  }

  async complete(key: string, response: StoredResponse): Promise<void> {
    const entry = this.#entries.get(key);
    if (entry) entry.response = response;
  }

  async release(key: string): Promise<void> {
    if (!this.#entries.get(key)?.response) this.#entries.delete(key);
  }
}
