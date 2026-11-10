import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { JwtTokenService } from '../../src/infrastructure/security/jwt-token-service.js';
import { makeTokenService } from '../support/tokens.js';

const service = makeTokenService();
const claims = { issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web', subject: 'user-1' };

describe('JwtTokenService', () => {
  it('round-trips claims and rejects a token signed with another secret', () => {
    const forger = new JwtTokenService({
      accessTokenSecret: 'a-completely-different-secret-of-32+chars',
      accessTokenTtlSeconds: 900,
    });

    const own = service.issueAccessToken({ userId: 'user-1', role: 'admin' });
    const forged = forger.issueAccessToken({ userId: 'user-1', role: 'admin' });

    expect(service.verifyAccessToken(own.token)).toEqual({ userId: 'user-1', role: 'admin' });
    expect(service.verifyAccessToken(forged.token)).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = jwt.sign({ role: 'admin' }, '', { ...claims, algorithm: 'none' });

    expect(service.verifyAccessToken(unsigned)).toBeNull();
  });
});
