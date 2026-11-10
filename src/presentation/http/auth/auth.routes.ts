import { Router, type RequestHandler } from 'express';

import type { AuthService } from '../../../application/auth/auth.service.js';

import type { AuthCookieSettings } from './auth.cookies.js';
import { createAuthController } from './auth.controller.js';

interface AuthRouterOptions {
  requireAuth: RequestHandler;
  loginRateLimiter: RequestHandler;
  cookies: AuthCookieSettings;
}

export function createAuthRouter(
  auth: AuthService,
  { requireAuth, loginRateLimiter, cookies }: AuthRouterOptions,
) {
  const controller = createAuthController(auth, cookies);
  const router = Router();

  router.post('/login', loginRateLimiter, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
