import { randomUUID } from 'node:crypto';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import type { AuthService } from '../../application/auth/auth.service.js';
import type { DoctorService } from '../../application/doctors/doctor.service.js';
import type { IdempotencyStore } from '../../application/ports/idempotency-store.js';

import { createAuthRouter } from './auth/auth.routes.js';
import { createDoctorRouter } from './doctors/doctor.routes.js';
import { createHealthRouter } from './health/health.routes.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import {
  createIdempotencyMiddleware,
  IDEMPOTENCY_HEADER,
  REPLAYED_HEADER,
} from './middleware/idempotency.js';
import { createApiRateLimiter, createLoginRateLimiter } from './middleware/rate-limit.js';
import { createRequireAuth } from './middleware/require-auth.js';

/** Everything the HTTP layer needs, injected by the composition root (or by tests). */
export interface AppDependencies {
  services: { doctors: DoctorService; auth: AuthService };
  idempotencyStore: IdempotencyStore;
  logger: Logger;
  isDatabaseHealthy: () => boolean;
  options: {
    corsOrigins: string[];
    trustProxy: number;
    exposeErrorStack: boolean;
    /** HTTPS-only auth cookies (production). */
    secureCookies: boolean;
  };
}

export function createApp({
  services,
  idempotencyStore,
  logger,
  isDatabaseHealthy,
  options,
}: AppDependencies): Express {
  const app = express();

  app.set('trust proxy', options.trustProxy);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Keep access logs lean: no headers, bodies or query strings (they can contain PII).
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: options.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Request-Id', IDEMPOTENCY_HEADER],
      exposedHeaders: ['X-Request-Id', 'Location', REPLAYED_HEADER],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const idempotent = createIdempotencyMiddleware(idempotencyStore);
  const requireAuth = createRequireAuth(services.auth);
  const cookies = { secure: options.secureCookies };

  const api = express.Router();
  // Public: health checks and the auth endpoints themselves.
  api.use('/health', createHealthRouter(isDatabaseHealthy));
  api.use(
    '/auth',
    createAuthRouter(services.auth, {
      requireAuth,
      loginRateLimiter: createLoginRateLimiter(),
      cookies,
    }),
  );
  // Everything below requires a signed-in user.
  api.use('/doctors', requireAuth, createDoctorRouter(services.doctors, idempotent));

  app.use('/api/v1', createApiRateLimiter(), api);

  app.use(notFoundHandler);
  app.use(createErrorHandler({ exposeStack: options.exposeErrorStack }));

  return app;
}
