// The same contracts, against real MongoDB with real indexes.
import { MongoDoctorRepository } from '../../src/infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';
import { MongoIdempotencyStore } from '../../src/infrastructure/database/mongoose/repositories/mongo-idempotency-store.js';
import { MongoSessionRepository } from '../../src/infrastructure/database/mongoose/repositories/mongo-session.repository.js';
import { describeDoctorRepositoryContract } from '../contract/doctor-repository.contract.js';
import { describeIdempotencyStoreContract } from '../contract/idempotency-store.contract.js';
import { describeSessionRepositoryContract } from '../contract/session-repository.contract.js';
import { useMongoMemoryServer } from '../support/mongo.js';

useMongoMemoryServer();
describeDoctorRepositoryContract('mongodb', () => new MongoDoctorRepository());
describeSessionRepositoryContract('mongodb', () => new MongoSessionRepository());
describeIdempotencyStoreContract('mongodb', () => new MongoIdempotencyStore());
