import { JwtTokenService } from '../../src/infrastructure/security/jwt-token-service.js';

export const TEST_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars';

/** The real JWT service (pure, no I/O) with the test secret from vitest.config.ts. */
export function makeTokenService(accessTokenTtlSeconds = 900) {
  return new JwtTokenService({ accessTokenSecret: TEST_ACCESS_SECRET, accessTokenTtlSeconds });
}
