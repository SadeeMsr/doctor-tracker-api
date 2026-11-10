import type { NewSession, RevocationReason, Session } from './session.entity.js';

/**
 * Persistence port for refresh-token sessions.
 *
 * Contract:
 * - `revokeIfActive` is atomic: of two concurrent calls for the same token, exactly one gets
 *   the session back; the other gets null. This is what makes rotation race-safe.
 * - Expired sessions may be deleted by the store at any time.
 */
export interface SessionRepository {
  create(session: NewSession): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /** Revokes the session if it is unrevoked and unexpired; returns it, or null otherwise. */
  revokeIfActive(tokenHash: string, now: Date, reason: RevocationReason): Promise<Session | null>;
  revokeAllForUser(userId: string, now: Date, reason: RevocationReason): Promise<void>;
}
