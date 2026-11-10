import { MongoIdempotencyStore } from '../../src/infrastructure/database/mongoose/repositories/mongo-idempotency-store.js';
import { describeIdempotencyStoreContract } from '../contract/idempotency-store.contract.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();
describeIdempotencyStoreContract('mongodb', (options) => new MongoIdempotencyStore(options));
