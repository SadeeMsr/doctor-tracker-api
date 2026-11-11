import { z } from 'zod';

import { SPECIALIZATIONS } from '../../../domain/doctor/doctor.entity.js';
import { emailField, personName, phoneField } from '../shared/fields.js';
import { dateRangeQuery, optionalText, paginationQuery } from '../shared/pagination.js';
import { csvList, repeatedList } from '../shared/query-lists.js';

export const createDoctorBody = z.object({
  name: personName,
  specialization: z.enum(SPECIALIZATIONS),
  hospital: z.string().trim().min(2).max(160),
  phone: phoneField,
  email: emailField,
});

export const updateDoctorBody = createDoctorBody
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listDoctorsQuery = paginationQuery
  .extend({
    search: optionalText(100),
    /** One or more: `?specialization=Cardiology,Oncology`. */
    specialization: csvList(z.enum(SPECIALIZATIONS)),
    /** One or more, repeated (names may contain commas): `?hospital=A&hospital=B`. */
    hospital: repeatedList(z.string().max(160)),
    sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .and(dateRangeQuery);
