import { describeIdempotencyStoreContract } from '../contract/idempotency-store.contract.js';
import { InMemoryIdempotencyStore } from '../support/in-memory-idempotency-store.js';

describeIdempotencyStoreContract('in-memory', (options) => new InMemoryIdempotencyStore(options));
