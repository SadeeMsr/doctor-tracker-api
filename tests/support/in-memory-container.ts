import { AnalyticsService } from '../../src/application/analytics/analytics.service.js';
import { AuthService } from '../../src/application/auth/auth.service.js';
import { DoctorService } from '../../src/application/doctors/doctor.service.js';
import { PatientService } from '../../src/application/patients/patient.service.js';
import { UserService } from '../../src/application/users/user.service.js';
import type { Container } from '../../src/container.js';

import { FakePasswordHasher } from './fake-password-hasher.js';
import { InMemoryDoctorRepository } from './in-memory-doctor.repository.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency-store.js';
import { InMemoryPatientRepository } from './in-memory-patient.repository.js';
import { InMemorySessionRepository } from './in-memory-session.repository.js';
import { InMemoryUserRepository } from './in-memory-user.repository.js';
import { StubAnalyticsQuery } from './stub-analytics-query.js';
import { makeTokenService } from './tokens.js';

/**
 * The whole application wired with in-memory adapters: the real HTTP stack, services and domain
 * rules, without a database. This works because every adapter sits behind a port (see
 * `src/container.ts`, which wires the Mongo versions).
 */
export function buildInMemoryContainer(): Container {
  const users = new InMemoryUserRepository();
  const doctors = new InMemoryDoctorRepository();
  const patients = new InMemoryPatientRepository(doctors);
  const hasher = new FakePasswordHasher();

  return {
    services: {
      doctors: new DoctorService(doctors, patients),
      patients: new PatientService(patients, doctors),
      analytics: new AnalyticsService(new StubAnalyticsQuery()),
      auth: new AuthService({
        users,
        sessions: new InMemorySessionRepository(),
        hasher,
        tokens: makeTokenService(),
        refreshTokenTtlSeconds: 3600,
      }),
      users: new UserService(users, hasher),
    },
    idempotencyStore: new InMemoryIdempotencyStore(),
  };
}
