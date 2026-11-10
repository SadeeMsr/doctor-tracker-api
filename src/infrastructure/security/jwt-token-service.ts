import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type {
  AccessTokenClaims,
  IssuedToken,
  TokenService,
} from '../../application/ports/token-service.js';
import { ROLES, type Role } from '../../domain/user/user.entity.js';

const ISSUER = 'doctor-tracker-api';
const AUDIENCE = 'doctor-tracker-web';

interface JwtTokenServiceOptions {
  accessTokenSecret: string;
  accessTokenTtlSeconds: number;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export class JwtTokenService implements TokenService {
  readonly #secret: string;
  readonly #ttlSeconds: number;

  constructor({ accessTokenSecret, accessTokenTtlSeconds }: JwtTokenServiceOptions) {
    this.#secret = accessTokenSecret;
    this.#ttlSeconds = accessTokenTtlSeconds;
  }

  issueAccessToken({ userId, role }: AccessTokenClaims): IssuedToken {
    const token = jwt.sign({ role }, this.#secret, {
      algorithm: 'HS256',
      subject: userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: this.#ttlSeconds,
    });
    return { token, expiresAt: new Date(Date.now() + this.#ttlSeconds * 1000) };
  }

  verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      // Pin the algorithm: never let the token header choose it (prevents `alg: none` attacks).
      const payload = jwt.verify(token, this.#secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload === 'string' || !payload.sub || !isRole(payload.role)) return null;
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  /** 256 bits of randomness: unguessable, so a fast hash is enough to store it. */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
