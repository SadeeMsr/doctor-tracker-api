import type { RequestHandler } from 'express';

import type { AuthService } from '../../../application/auth/auth.service.js';
import { ACCESS_COOKIE } from '../auth/auth.cookies.js';
import { readCookie } from '../shared/request-auth.js';

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
