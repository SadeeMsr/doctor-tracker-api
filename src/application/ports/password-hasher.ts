/** Slow, salted password hashing (argon2id in production). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** False for a wrong password or a malformed hash; never throws for either. */
  verify(passwordHash: string, password: string): Promise<boolean>;
}
