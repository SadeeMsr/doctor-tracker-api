import { z } from 'zod';

import { SPECIALIZATIONS } from '../../../domain/doctor/doctor.entity.js';
import { dateRangeQuery, optionalText, paginationQuery } from '../shared/pagination.js';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Invalid email address'));
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Invalid phone number');

export const createDoctorBody = z.object({
  name: z.string().trim().min(2).max(120),
  specialization: z.enum(SPECIALIZATIONS),
  hospital: z.string().trim().min(2).max(160),
  phone,
  email,
});

export const updateDoctorBody = createDoctorBody
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listDoctorsQuery = paginationQuery
  .extend({
    search: optionalText(100),
    specialization: z.enum(SPECIALIZATIONS).optional(),
    hospital: optionalText(160),
    sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .and(dateRangeQuery);
