import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { JwtTokenService } from '../../src/infrastructure/security/jwt-token-service.js';
import { makeTokenService, TEST_ACCESS_SECRET } from '../support/tokens.js';

const service = makeTokenService();

describe('JwtTokenService', () => {
  it('round-trips claims', () => {
    const { token } = service.issueAccessToken({ userId: 'user-1', role: 'admin' });

    expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-1', role: 'admin' });
  });

  it('rejects a token signed with another secret', () => {
    const other = new JwtTokenService({
      accessTokenSecret: 'a-completely-different-secret-of-32+chars',
      accessTokenTtlSeconds: 900,
    });
    const { token } = other.issueAccessToken({ userId: 'user-1', role: 'admin' });

    expect(service.verifyAccessToken(token)).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = jwt.sign({ role: 'admin' }, '', {
      algorithm: 'none',
      subject: 'user-1',
      issuer: 'doctor-tracker-api',
      audience: 'doctor-tracker-web',
    });

    expect(service.verifyAccessToken(unsigned)).toBeNull();
  });

  it('rejects a valid signature with the wrong audience or an unknown role', () => {
    const wrongAudience = jwt.sign({ role: 'admin' }, TEST_ACCESS_SECRET, {
      subject: 'user-1',
      issuer: 'doctor-tracker-api',
      audience: 'someone-else',
    });
    const unknownRole = jwt.sign({ role: 'superuser' }, TEST_ACCESS_SECRET, {
      subject: 'user-1',
      issuer: 'doctor-tracker-api',
      audience: 'doctor-tracker-web',
    });

    expect(service.verifyAccessToken(wrongAudience)).toBeNull();
    expect(service.verifyAccessToken(unknownRole)).toBeNull();
  });

  it('generates unguessable refresh tokens and hashes them deterministically', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(service.hashRefreshToken(a)).toBe(service.hashRefreshToken(a));
    expect(service.hashRefreshToken(a)).not.toBe(a);
  });
});
