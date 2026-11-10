import { z } from 'zod';

/** Field rules shared by every resource that has contact details. */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Invalid email address'));

export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Invalid phone number');

export const personName = z.string().trim().min(2).max(120);
