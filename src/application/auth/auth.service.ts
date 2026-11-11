import { UnauthorizedError } from '../../domain/shared/errors.js';
import type { SessionRepository } from '../../domain/session/session.repository.js';
import { normalizeEmail, type User } from '../../domain/user/user.entity.js';
import type { UserRepository } from '../../domain/user/user.repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';
import type { AccessTokenClaims, IssuedToken, TokenService } from '../ports/token-service.js';

/**
 * Two tabs whose access tokens expire together both refresh with the same token. The browser
 * already holds the new cookies from the first, so the second is benign, not token theft.
 */
export const ROTATION_GRACE_MS = 10_000;

const INVALID_CREDENTIALS = 'Invalid email or password';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

export interface AuthTokens {
  accessToken: IssuedToken;
  refreshToken: IssuedToken;
}

export type RefreshResult =
  | ({ status: 'rotated' } & AuthTokens)
  /** Already rotated a moment ago by a concurrent request: keep the cookies the browser has. */
  | { status: 'superseded' };

interface AuthServiceDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  refreshTokenTtlSeconds: number;
}

/** Login, refresh-token rotation with reuse detection, logout and request authentication. */
export class AuthService {
  readonly #users: UserRepository;
  readonly #sessions: SessionRepository;
  readonly #hasher: PasswordHasher;
  readonly #tokens: TokenService;
  readonly #refreshTokenTtlMs: number;
  #dummyHash: Promise<string> | undefined;

  constructor({
    users,
    sessions,
    hasher,
    tokens,
    refreshTokenTtlSeconds,
  }: AuthServiceDependencies) {
    this.#users = users;
    this.#sessions = sessions;
    this.#hasher = hasher;
    this.#tokens = tokens;
    this.#refreshTokenTtlMs = refreshTokenTtlSeconds * 1000;
  }

  async login(email: string, password: string): Promise<{ user: User } & AuthTokens> {
    const user = await this.#users.findByEmail(normalizeEmail(email));

    // Verify against a dummy hash for unknown emails too, so response timing doesn't reveal
    // which emails have accounts.
    const hash = user?.passwordHash ?? (await this.#getDummyHash());
    const valid = await this.#hasher.verify(hash, password);
    if (!user || !valid) throw new UnauthorizedError(INVALID_CREDENTIALS);

    return { user, ...(await this.#startSession(user)) };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const tokenHash = this.#tokens.hashRefreshToken(refreshToken);
    const now = new Date();

    const session = await this.#sessions.revokeIfActive(tokenHash, now, 'rotated');
    if (session) {
      const user = await this.#users.findById(session.userId);
      if (!user) throw new UnauthorizedError(SESSION_EXPIRED);
      return { status: 'rotated', ...(await this.#startSession(user)) };
    }

    const existing = await this.#sessions.findByTokenHash(tokenHash);
    if (!existing?.revokedAt || existing.expiresAt <= now) {
      throw new UnauthorizedError(SESSION_EXPIRED);
    }
    const rotatedMomentsAgo =
      existing.revokedReason === 'rotated' &&
      now.getTime() - existing.revokedAt.getTime() <= ROTATION_GRACE_MS;
    if (rotatedMomentsAgo) return { status: 'superseded' };

    // A dead token came back (long after rotation, or after logout/lockout): it was stolen or
    // leaked. End every session of the user. Only the first reuse triggers it; later ones just 401.
    if (existing.revokedReason === 'rotated') {
      await this.#sessions.revokeAllForUser(existing.userId, now, 'reuse-detected');
    }
    throw new UnauthorizedError(SESSION_EXPIRED);
  }

  /** Idempotent: an unknown, expired or already-revoked token is simply ignored. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.#sessions.revokeIfActive(
      this.#tokens.hashRefreshToken(refreshToken),
      new Date(),
      'logout',
    );
  }

  /** Verifies an access token; stateless, so it costs no database round trip. */
  authenticate(accessToken: string | undefined): AccessTokenClaims {
    const claims = accessToken ? this.#tokens.verifyAccessToken(accessToken) : null;
    if (!claims) throw new UnauthorizedError('Authentication required');
    return claims;
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.#users.findById(userId);
    if (!user) throw new UnauthorizedError(SESSION_EXPIRED);
    return user;
  }

  async #startSession(user: User): Promise<AuthTokens> {
    const token = this.#tokens.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.#refreshTokenTtlMs);
    await this.#sessions.create({
      userId: user.id,
      tokenHash: this.#tokens.hashRefreshToken(token),
      expiresAt,
    });

    return {
      accessToken: this.#tokens.issueAccessToken({ userId: user.id, role: user.role }),
      refreshToken: { token, expiresAt },
    };
  }

  #getDummyHash(): Promise<string> {
    this.#dummyHash ??= this.#hasher.hash('timing-equalization-placeholder');
    return this.#dummyHash;
  }
}
