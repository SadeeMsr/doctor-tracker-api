import type { PasswordHasher } from '../../src/application/ports/password-hasher.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

/** Instant, deterministic stand-in for argon2 in unit tests. Never use outside tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return passwordHash === `hashed:${password}`;
  }
}
