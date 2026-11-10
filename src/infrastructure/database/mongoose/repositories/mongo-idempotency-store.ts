import type {
  IdempotencyClaim,
  IdempotencyStore,
  StoredResponse,
} from '../../../../application/ports/idempotency-store.js';
import { IdempotencyKeyModel, type IdempotencyKeyRecord } from '../models/idempotency-key.model.js';
import { isDuplicateKeyError } from '../utils.js';

const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
const MAX_CLAIM_ATTEMPTS = 3;

function toClaim(record: IdempotencyKeyRecord): IdempotencyClaim {
  if (record.status === 'completed' && record.response) {
    return {
      status: 'completed',
      requestHash: record.requestHash,
      response: {
        statusCode: record.response.statusCode ?? 200,
        body: record.response.body as unknown,
        ...(record.response.location && { location: record.response.location }),
      },
    };
  }
  return { status: 'processing', requestHash: record.requestHash };
}

export class MongoIdempotencyStore implements IdempotencyStore {
  readonly #lockTimeoutMs: number;

  constructor({ lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS }: { lockTimeoutMs?: number } = {}) {
    this.#lockTimeoutMs = lockTimeoutMs;
  }

  async claim(key: string, requestHash: string): Promise<IdempotencyClaim> {
    for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
      try {
        // Atomic: the unique index guarantees only one concurrent insert succeeds.
        await IdempotencyKeyModel.create({ key, requestHash, status: 'processing' });
        return { status: 'claimed' };
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }

      // Take over a claim abandoned by a crashed request, atomically.
      const takenOver = await IdempotencyKeyModel.findOneAndUpdate(
        {
          key,
          status: 'processing',
          createdAt: { $lt: new Date(Date.now() - this.#lockTimeoutMs) },
        },
        { $set: { requestHash, createdAt: new Date() } },
      ).lean();
      if (takenOver) return { status: 'claimed' };

      const existing = await IdempotencyKeyModel.findOne({ key }).lean<IdempotencyKeyRecord>();
      if (existing) return toClaim(existing);
      // The record was released between our insert and read: try to claim again.
    }
    throw new Error(`Could not claim idempotency key after ${String(MAX_CLAIM_ATTEMPTS)} attempts`);
  }

  async complete(key: string, response: StoredResponse): Promise<void> {
    await IdempotencyKeyModel.updateOne({ key }, { $set: { status: 'completed', response } });
  }

  async release(key: string): Promise<void> {
    await IdempotencyKeyModel.deleteOne({ key, status: 'processing' });
  }
}
