import type { CookieOptions, Response } from 'express';

import type { AuthTokens } from '../../../application/auth/auth.service.js';

/** Must match the web app's AUTH_COOKIES constant. */
export const ACCESS_COOKIE = 'dt_access';
export const REFRESH_COOKIE = 'dt_refresh';

export interface AuthCookieSettings {
  /** HTTPS-only cookies. On in production; off on http://localhost. */
  secure: boolean;
}

/*
 * - httpOnly: JavaScript (and so any XSS) can never read the tokens.
 * - sameSite lax: the browser doesn't send them on cross-site POSTs, which is the CSRF defence.
 * - path /: the web app's proxy.ts checks for the refresh cookie on page requests.
 * - no domain: host-only on the web origin, because the web app proxies /api to this server.
 */
function baseOptions({ secure }: AuthCookieSettings): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

export function setAuthCookies(res: Response, tokens: AuthTokens, settings: AuthCookieSettings) {
  const options = baseOptions(settings);
  res.cookie(ACCESS_COOKIE, tokens.accessToken.token, {
    ...options,
    expires: tokens.accessToken.expiresAt,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken.token, {
    ...options,
    expires: tokens.refreshToken.expiresAt,
  });
}

export function clearAuthCookies(res: Response, settings: AuthCookieSettings) {
  const options = baseOptions(settings);
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}
