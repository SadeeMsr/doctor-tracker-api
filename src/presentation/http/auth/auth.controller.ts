import type { AuthService } from '../../../application/auth/auth.service.js';
import { HttpError } from '../errors/http-error.js';
import { handle } from '../shared/handle.js';
import { getAuth, readCookie } from '../shared/request-auth.js';

import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
  type AuthCookieSettings,
} from './auth.cookies.js';
import { presentUser } from './auth.presenter.js';
import { loginBody } from './auth.schemas.js';

export function createAuthController(auth: AuthService, cookies: AuthCookieSettings) {
  return {
    login: handle({ body: loginBody }, async (req, res) => {
      const { user, ...tokens } = await auth.login(req.body.email, req.body.password);
      setAuthCookies(res, tokens, cookies);
      res.json({ data: presentUser(user) });
    }),

    refresh: handle({}, async (req, res) => {
      const token = readCookie(req, REFRESH_COOKIE);
      if (!token) {
        clearAuthCookies(res, cookies);
        throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // A failed refresh must also drop the cookies; otherwise the web app's proxy still sees
      // a session and bounces between /login and the dashboard.
      const result = await auth.refresh(token).catch((error: unknown) => {
        clearAuthCookies(res, cookies);
        throw error;
      });

      if (result.status === 'rotated') setAuthCookies(res, result, cookies);
      res.status(204).end();
    }),

    logout: handle({}, async (req, res) => {
      await auth.logout(readCookie(req, REFRESH_COOKIE));
      clearAuthCookies(res, cookies);
      res.status(204).end();
    }),

    me: handle({}, async (req, res) => {
      const user = await auth.getCurrentUser(getAuth(req).userId);
      res.json({ data: presentUser(user) });
    }),
  };
}
