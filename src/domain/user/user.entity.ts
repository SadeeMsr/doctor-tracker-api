export const ROLES = ['admin'] as const;

export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Credential; never leaves the application layer (presenters must not include it). */
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewUser = Pick<User, 'email' | 'name' | 'role' | 'passwordHash'>;

/** Emails are case-insensitive identities. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
