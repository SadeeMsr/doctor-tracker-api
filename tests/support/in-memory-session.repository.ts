import type {
  NewSession,
  RevocationReason,
  Session,
} from '../../src/domain/session/session.entity.js';
import type { SessionRepository } from '../../src/domain/session/session.repository.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

export class InMemorySessionRepository implements SessionRepository {
  readonly #sessions = new Map<string, Session>();
  #sequence = 0;

  async create(session: NewSession): Promise<Session> {
    const id = (++this.#sequence).toString(16).padStart(24, '0');
    const created: Session = {
      ...session,
      id,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    };
    this.#sessions.set(session.tokenHash, created);
    return { ...created };
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const session = this.#sessions.get(tokenHash);
    return session ? { ...session } : null;
  }

  async revokeIfActive(
    tokenHash: string,
    now: Date,
    reason: RevocationReason,
  ): Promise<Session | null> {
    const session = this.#sessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    session.revokedAt = now;
    session.revokedReason = reason;
    return { ...session };
  }

  async revokeAllForUser(userId: string, now: Date, reason: RevocationReason): Promise<void> {
    for (const session of this.#sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = now;
        session.revokedReason = reason;
      }
    }
  }

  /** Test helper: pretend a session was revoked `ms` milliseconds ago. */
  backdateRevocation(tokenHash: string, ms: number): void {
    const session = this.#sessions.get(tokenHash);
    if (session?.revokedAt) session.revokedAt = new Date(session.revokedAt.getTime() - ms);
  }
}
