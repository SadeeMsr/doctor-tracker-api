import { z } from 'zod';

export const loginBody = z.object({
  email: z.string().trim().max(254).pipe(z.email('Enter a valid email address')),
  // No complexity rules on login: they belong to password creation, and would leak policy.
  password: z.string().min(1, 'Password is required').max(256),
});
