import type { NewUser, User } from '../../src/domain/user/user.entity.js';
import type { UserRepository } from '../../src/domain/user/user.repository.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

export class InMemoryUserRepository implements UserRepository {
  readonly #users = new Map<string, User>();
  #sequence = 0;

  async findById(id: string): Promise<User | null> {
    const user = this.#users.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = [...this.#users.values()].find((candidate) => candidate.email === email);
    return user ? { ...user } : null;
  }

  async upsertByEmail(data: NewUser): Promise<User> {
    const now = new Date();
    const existing = await this.findByEmail(data.email);
    const id = existing?.id ?? (++this.#sequence).toString(16).padStart(24, '0');
    const user: User = { ...data, id, createdAt: existing?.createdAt ?? now, updatedAt: now };
    this.#users.set(id, user);
    return { ...user };
  }
}
