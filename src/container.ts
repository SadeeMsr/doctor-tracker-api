import { AnalyticsService } from './application/analytics/analytics.service.js';
import { AuthService } from './application/auth/auth.service.js';
import { DoctorService } from './application/doctors/doctor.service.js';
import { PatientService } from './application/patients/patient.service.js';
import type { IdempotencyStore } from './application/ports/idempotency-store.js';
import { UserService } from './application/users/user.service.js';
import { env } from './config/env.js';
import { CachedAnalyticsQuery } from './infrastructure/cache/cached-analytics-query.js';
import { MongoAnalyticsQuery } from './infrastructure/database/mongoose/repositories/mongo-analytics-query.js';
import { MongoDoctorRepository } from './infrastructure/database/mongoose/repositories/mongo-doctor.repository.js';
import { MongoPatientRepository } from './infrastructure/database/mongoose/repositories/mongo-patient.repository.js';
import { MongoIdempotencyStore } from './infrastructure/database/mongoose/repositories/mongo-idempotency-store.js';
import { MongoSessionRepository } from './infrastructure/database/mongoose/repositories/mongo-session.repository.js';
import { MongoUserRepository } from './infrastructure/database/mongoose/repositories/mongo-user.repository.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { JwtTokenService } from './infrastructure/security/jwt-token-service.js';

export interface Container {
  services: {
    doctors: DoctorService;
    patients: PatientService;
    analytics: AnalyticsService;
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
  const doctors = new MongoDoctorRepository();
  const patients = new MongoPatientRepository();
  const hasher = new Argon2PasswordHasher();
  const tokens = new JwtTokenService({
    accessTokenSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
  });

  return {
    services: {
      doctors: new DoctorService(doctors, patients),
      patients: new PatientService(patients, doctors),
      // Repeated dashboard loads within 30 s are answered from memory.
      analytics: new AnalyticsService(
        new CachedAnalyticsQuery(new MongoAnalyticsQuery(), { ttlMs: 30_000 }),
      ),
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
