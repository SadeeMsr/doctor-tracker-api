import type { User } from '../../../domain/user/user.entity.js';

/** The public shape of a user. The password hash never leaves the API. */
export function presentUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
