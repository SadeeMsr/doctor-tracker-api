import { z } from 'zod';

import { GENDERS, PATIENT_CONDITIONS } from '../../../domain/patient/patient.entity.js';
import { emailField, personName, phoneField } from '../shared/fields.js';
import { dateRangeQuery, optionalText, paginationQuery } from '../shared/pagination.js';
import { csvList } from '../shared/query-lists.js';
import { idString } from '../shared/params.js';

const dateOfBirth = z.coerce
  .date()
  .refine((date) => date <= new Date(), 'Date of birth cannot be in the future')
  .refine((date) => date.getUTCFullYear() >= 1900, 'Enter a valid date of birth');

const admittedAt = z.coerce
  .date()
  .refine(
    (date) => date.getTime() <= Date.now() + 60_000,
    'Admission date cannot be in the future',
  );

/** Optional email: `''` or `null` clears it, while leaving it out means "unchanged". */
const optionalEmail = z
  .union([z.literal(''), z.null(), emailField])
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const patientFields = z.object({
  name: personName,
  dateOfBirth,
  gender: z.enum(GENDERS),
  phone: phoneField,
  email: optionalEmail,
  condition: z.enum(PATIENT_CONDITIONS),
  diagnosis: z.string().trim().min(2).max(500),
  admittedAt,
});

export const createPatientBody = patientFields.extend({
  email: optionalEmail.transform((value) => value ?? null),
  admittedAt: admittedAt.default(() => new Date()),
});

/** Any field can change, including moving the patient to another doctor. */
export const updatePatientBody = patientFields
  .extend({ doctorId: idString })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

/** `?condition=critical,stable` or `?condition=critical&condition=stable`. */
const conditionList = csvList(z.enum(PATIENT_CONDITIONS));

const patientFilters = paginationQuery.extend({
  search: optionalText(100),
  condition: conditionList,
  gender: z.enum(GENDERS).optional(),
  sortBy: z.enum(['admittedAt', 'name', 'createdAt']).default('admittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const listPatientsQuery = patientFilters
  .extend({ doctorId: optionalText(64) })
  .and(dateRangeQuery);

export const listDoctorPatientsQuery = patientFilters.and(dateRangeQuery);

export const doctorPatientParams = z.object({ id: idString, patientId: idString });
