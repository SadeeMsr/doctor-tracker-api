import type { Request } from 'express';

import type { AccessTokenClaims } from '../../../application/ports/token-service.js';
import { HttpError } from '../errors/http-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth` once the access token has been verified. */
    auth?: AccessTokenClaims;
  }
}

/** The authenticated caller. Only valid on routes behind `requireAuth`. */
export function getAuth(req: Request): AccessTokenClaims {
  if (!req.auth) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.auth;
}

/** A cookie value as a string, or undefined (cookie-parser types cookies as `any`). */
export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
