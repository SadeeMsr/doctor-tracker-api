import { AuthService } from './application/auth/auth.service.js';
import { DoctorService } from './application/doctors/doctor.service.js';
import type { IdempotencyStore } from './application/ports/idempotency-store.js';
import { UserService } from './application/users/user.service.js';
import { env } from './config/env.js';
import { MongoDoctorRepository } from './infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';
import { MongoIdempotencyStore } from './infrastructure/database/mongoose/repositories/mongo-idempotency-store.js';
import { MongoSessionRepository } from './infrastructure/database/mongoose/repositories/mongo-session.repository.js';
import { MongoUserRepository } from './infrastructure/database/mongoose/repositories/mongo-user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JwtTokenService } from './infrastructure/security/jwt-token-service.js';

export interface Container {
  services: {
    doctors: DoctorService;
    auth: AuthService;
    users: UserService;
  };
  /** Typed as the port, so tests can substitute any adapter. */
  idempotencyStore: IdempotencyStore;
}

/**
 * Composition root: the only place that knows which concrete adapters back each port.
 * Swapping MongoDB for another database means changing the adapters created here.
 */
export function buildContainer(): Container {
  const users = new MongoUserRepository();
  const hasher = new Argon2PasswordHasher();
  const tokens = new JwtTokenService({
    accessTokenSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
  });

  return {
    services: {
      doctors: new DoctorService(new MongoDoctorRepository()),
      auth: new AuthService({
        users,
        sessions: new MongoSessionRepository(),
        hasher,
        tokens,
        refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
      }),
      users: new UserService(users, hasher),
    },
    idempotencyStore: new MongoIdempotencyStore(),
  };
}

export type Services = Container['services'];
