import { normalizeEmail, type Role, type User } from '../../domain/user/user.entity.js';
import type { UserRepository } from '../../domain/user/user.repository.js';
import type { PasswordHasher } from '../ports/password-hasher.js';

interface AccountInput {
  email: string;
  name: string;
  password: string;
  role?: Role;
}

/** User management. The portal has no sign-up, so accounts are provisioned here. */
export class UserService {
  readonly #users: UserRepository;
  readonly #hasher: PasswordHasher;

  constructor(users: UserRepository, hasher: PasswordHasher) {
    this.#users = users;
    this.#hasher = hasher;
  }

  /** Creates the account, or resets its name and password. Safe to run repeatedly. */
  async provisionAccount({ email, name, password, role = 'admin' }: AccountInput): Promise<User> {
    return this.#users.upsertByEmail({
      email: normalizeEmail(email),
      name: name.trim(),
      role,
      passwordHash: await this.#hasher.hash(password),
    });
  }
}
