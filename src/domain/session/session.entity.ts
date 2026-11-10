export const REVOCATION_REASONS = ['rotated', 'logout', 'reuse-detected'] as const;

/** Why a session ended. Only `rotated` qualifies for the concurrent-refresh grace window. */
export type RevocationReason = (typeof REVOCATION_REASONS)[number];

/** One login on one device: backs a refresh token. */
export interface Session {
  id: string;
  userId: string;
  /** SHA-256 of the refresh token. The token itself is never stored. */
  tokenHash: string;
  expiresAt: Date;
  /** Set when the token was rotated or the user logged out. */
  revokedAt: Date | null;
  revokedReason: RevocationReason | null;
  createdAt: Date;
}

export type NewSession = Pick<Session, 'userId' | 'tokenHash' | 'expiresAt'>;
