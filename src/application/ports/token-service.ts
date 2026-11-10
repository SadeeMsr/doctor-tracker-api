import type { Role } from '../../domain/user/user.entity.js';

export interface AccessTokenClaims {
  userId: string;
  role: Role;
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Access tokens are signed and short-lived (stateless checks on every request). Refresh tokens
 * are opaque random strings, revocable because their hash is stored in a session.
 */
export interface TokenService {
  issueAccessToken(claims: AccessTokenClaims): IssuedToken;
  /** Null for any invalid, expired or tampered token. */
  verifyAccessToken(token: string): AccessTokenClaims | null;
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string;
}
