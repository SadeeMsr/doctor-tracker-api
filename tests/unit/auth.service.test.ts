import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService, ROTATION_GRACE_MS } from '../../src/application/auth/auth.service.js';
import { UserService } from '../../src/application/users/user.service.js';
import { UnauthorizedError } from '../../src/domain/shared/errors.js';
import { FakePasswordHasher } from '../support/fake-password-hasher.js';
import { InMemorySessionRepository } from '../support/in-memory-session.repository.js';
import { InMemoryUserRepository } from '../support/in-memory-user.repository.js';
import { makeTokenService } from '../support/tokens.js';

const tokens = makeTokenService();
const CREDENTIALS = { email: 'admin@example.com', password: 'Correct-Horse-9' };

describe('AuthService', () => {
  let sessions: InMemorySessionRepository;
  let auth: AuthService;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    sessions = new InMemorySessionRepository();
    auth = new AuthService({ users, sessions, hasher, tokens, refreshTokenTtlSeconds: 3600 });
    await new UserService(users, hasher).provisionAccount({ ...CREDENTIALS, name: 'Admin' });
  });

  describe('login', () => {
    it('returns the user and a verifiable access token', async () => {
      const { user, accessToken, refreshToken } = await auth.login(
        ' Admin@Example.com ',
        CREDENTIALS.password,
      );

      expect(user.email).toBe('admin@example.com');
      expect(auth.authenticate(accessToken.token)).toEqual({ userId: user.id, role: 'admin' });
      expect(refreshToken.token).toEqual(expect.any(String));
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = auth.login(CREDENTIALS.email, 'wrong');
      const unknownEmail = auth.login('nobody@example.com', CREDENTIALS.password);

      await expect(wrongPassword).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(unknownEmail).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(wrongPassword).rejects.toThrow('Invalid email or password');
      await expect(unknownEmail).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('rotates: the old token stops working and a new pair is issued', async () => {
      const { refreshToken } = await auth.login(CREDENTIALS.email, CREDENTIALS.password);

      const result = await auth.refresh(refreshToken.token);

      expect(result.status).toBe('rotated');
      if (result.status !== 'rotated') return;
      expect(result.refreshToken.token).not.toBe(refreshToken.token);
      await expect(auth.refresh(result.refreshToken.token)).resolves.toMatchObject({
        status: 'rotated',
      });
    });

    it('treats a reuse within the grace window as a concurrent tab, not theft', async () => {
      const { refreshToken } = await auth.login(CREDENTIALS.email, CREDENTIALS.password);
      const rotated = await auth.refresh(refreshToken.token);

      await expect(auth.refresh(refreshToken.token)).resolves.toEqual({ status: 'superseded' });
      if (rotated.status === 'rotated') {
        await expect(auth.refresh(rotated.refreshToken.token)).resolves.toMatchObject({
          status: 'rotated',
        });
      }
    });

    it('revokes every session of the user when an old token is reused after the grace window', async () => {
      const { refreshToken } = await auth.login(CREDENTIALS.email, CREDENTIALS.password);
      const rotated = await auth.refresh(refreshToken.token);
      sessions.backdateRevocation(
        tokens.hashRefreshToken(refreshToken.token),
        ROTATION_GRACE_MS + 1,
      );

      await expect(auth.refresh(refreshToken.token)).rejects.toBeInstanceOf(UnauthorizedError);
      // The legitimate user's current token is now dead too: the attacker can't keep a session.
      if (rotated.status === 'rotated') {
        await expect(auth.refresh(rotated.refreshToken.token)).rejects.toBeInstanceOf(
          UnauthorizedError,
        );
      }
    });

    it('rejects an unknown token', async () => {
      await expect(auth.refresh('made-up-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('logout', () => {
    it('revokes the session and is idempotent', async () => {
      const { refreshToken } = await auth.login(CREDENTIALS.email, CREDENTIALS.password);

      await auth.logout(refreshToken.token);
      await auth.logout(refreshToken.token);
      await auth.logout(undefined);

      // Immediately: the rotation grace window must not apply to a logged-out session.
      await expect(auth.refresh(refreshToken.token)).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('authenticate', () => {
    it('rejects missing, garbage and expired tokens', () => {
      const expired = makeTokenService(-1).issueAccessToken({ userId: 'u1', role: 'admin' });

      expect(() => auth.authenticate(undefined)).toThrow(UnauthorizedError);
      expect(() => auth.authenticate('garbage')).toThrow(UnauthorizedError);
      expect(() => auth.authenticate(expired.token)).toThrow(UnauthorizedError);
    });
  });
});
