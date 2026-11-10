import { rateLimit } from 'express-rate-limit';

import { HttpError } from '../errors/http-error.js';

const tooManyRequests = (message: string) => new HttpError(429, 'TOO_MANY_REQUESTS', message);

/** Broad limiter for the whole API. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many requests, please try again later'));
  },
});

/** Strict limiter for credential endpoints to slow down brute-force attempts. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(tooManyRequests('Too many login attempts, please try again in 15 minutes'));
  },
});
