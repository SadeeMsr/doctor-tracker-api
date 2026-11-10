// The in-memory fakes used by unit tests must pass the same contracts as the real adapters.
import { describeDoctorRepositoryContract } from '../contract/doctor-repository.contract.js';
import { describeIdempotencyStoreContract } from '../contract/idempotency-store.contract.js';
import { describeSessionRepositoryContract } from '../contract/session-repository.contract.js';
import { InMemoryDoctorRepository } from '../support/in-memory-doctor.repository.js';
import { InMemoryIdempotencyStore } from '../support/in-memory-idempotency-store.js';
import { InMemorySessionRepository } from '../support/in-memory-session.repository.js';

describeDoctorRepositoryContract('in-memory', () => new InMemoryDoctorRepository());
describeSessionRepositoryContract('in-memory', () => new InMemorySessionRepository());
describeIdempotencyStoreContract('in-memory', () => new InMemoryIdempotencyStore());
