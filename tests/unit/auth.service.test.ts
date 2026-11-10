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

/** Pure use-case tests: no database, no HTTP. */
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

  const login = () => auth.login(CREDENTIALS.email, CREDENTIALS.password);

  it('gives the same error for a wrong password and an unknown email (no account enumeration)', async () => {
    const wrongPassword = auth.login(CREDENTIALS.email, 'wrong');
    const unknownEmail = auth.login('nobody@example.com', CREDENTIALS.password);

    await expect(wrongPassword).rejects.toThrow(new UnauthorizedError('Invalid email or password'));
    await expect(unknownEmail).rejects.toThrow(new UnauthorizedError('Invalid email or password'));
  });

  it('rotates refresh tokens and treats a reuse within the grace window as a second tab', async () => {
    const { refreshToken } = await login();

    const rotated = await auth.refresh(refreshToken.token);
    const concurrentTab = await auth.refresh(refreshToken.token);

    expect(rotated.status).toBe('rotated');
    expect(concurrentTab).toEqual({ status: 'superseded' });
  });

  it('locks the user out everywhere when an old token is reused after the grace window', async () => {
    const { refreshToken } = await login();
    const rotated = await auth.refresh(refreshToken.token);
    if (rotated.status !== 'rotated') throw new Error('expected a rotation');
    sessions.backdateRevocation(tokens.hashRefreshToken(refreshToken.token), ROTATION_GRACE_MS + 1);

    await expect(auth.refresh(refreshToken.token)).rejects.toBeInstanceOf(UnauthorizedError);
    // The current token dies too, so a thief can't keep the session alive.
    await expect(auth.refresh(rotated.refreshToken.token)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('does not give a logged-out session the rotation grace window', async () => {
    const { refreshToken } = await login();

    await auth.logout(refreshToken.token);
    await auth.logout(refreshToken.token); // idempotent

    await expect(auth.refresh(refreshToken.token)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
