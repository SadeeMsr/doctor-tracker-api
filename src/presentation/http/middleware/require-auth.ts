import type { RequestHandler } from 'express';

import type { AuthService } from '../../../application/auth/auth.service.js';
import type { Role } from '../../../domain/user/user.entity.js';
import { ACCESS_COOKIE } from '../auth/auth.cookies.js';
import { HttpError } from '../errors/http-error.js';
import { getAuth, readCookie } from '../shared/request-auth.js';

/**
 * Verifies the access-token cookie and exposes the caller as `req.auth`. A missing, expired or
 * tampered token is a 401; the web client then refreshes once and retries.
 */
export function createRequireAuth(auth: AuthService): RequestHandler {
  return (req, _res, next) => {
    req.auth = auth.authenticate(readCookie(req, ACCESS_COOKIE));
    next();
  };
}

/** Authorization: use after `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuth(req).role)) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
}
