import { rateLimit } from 'express-rate-limit';

import { HttpError } from '../errors/http-error.js';

const tooManyRequests = (message: string) => new HttpError(429, 'TOO_MANY_REQUESTS', message);

/*
 * Factories rather than singletons: each app instance gets its own counters, so there is no
 * shared module state between tests. Counters live in memory, so they are per process; use a
 * shared store (e.g. Redis) once the API runs more than one instance.
 */

/** Broad limiter for the whole API. */
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(tooManyRequests('Too many requests, please try again later'));
    },
  });
}

/** Strict limiter for credential endpoints: only failed attempts count. */
export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(tooManyRequests('Too many login attempts, please try again in 15 minutes'));
    },
  });
}
