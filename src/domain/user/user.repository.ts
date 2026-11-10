import type { NewUser, User } from './user.entity.js';

/**
 * Persistence port for users.
 *
 * Contract:
 * - Emails are stored and matched exactly as given (callers normalise them first).
 * - Unknown or malformed ids behave like "not found" (null), never throw.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Creates the user, or updates name/role/password of the one with this email. Idempotent. */
  upsertByEmail(data: NewUser): Promise<User>;
}
