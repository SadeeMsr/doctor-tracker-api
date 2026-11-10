import { AuthService } from '../../src/application/auth/auth.service.js';
import { DoctorService } from '../../src/application/doctors/doctor.service.js';
import { UserService } from '../../src/application/users/user.service.js';
import type { Container } from '../../src/container.js';

import { FakePasswordHasher } from './fake-password-hasher.js';
import { InMemoryDoctorRepository } from './in-memory-doctor.repository.js';
import { InMemoryIdempotencyStore } from './in-memory-idempotency-store.js';
import { InMemorySessionRepository } from './in-memory-session.repository.js';
import { InMemoryUserRepository } from './in-memory-user.repository.js';
import { makeTokenService } from './tokens.js';

/** The whole application wired with in-memory adapters: the HTTP stack without a database. */
export function buildInMemoryContainer(): Container {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();

  return {
    services: {
      doctors: new DoctorService(new InMemoryDoctorRepository()),
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
