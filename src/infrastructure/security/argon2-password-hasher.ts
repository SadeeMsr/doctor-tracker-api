import * as argon2 from 'argon2';

import type { PasswordHasher } from '../../application/ports/password-hasher.js';

/**
 * argon2id (OWASP's first choice: memory-hard, so GPU cracking is expensive). Library defaults:
 * 64 MiB memory, 3 iterations, 4 lanes, which is above OWASP's minimum (19 MiB, 2, 1).
 */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      // A malformed stored hash is a failed login, not a server error.
      return false;
    }
  }
}
