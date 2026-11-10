import type { Doctor } from '../doctor/doctor.entity.js';

export const PATIENT_CONDITIONS = [
  'stable',
  'under-observation',
  'critical',
  'recovering',
  'discharged',
] as const;

export const GENDERS = ['female', 'male', 'other'] as const;

export type PatientCondition = (typeof PATIENT_CONDITIONS)[number];
export type Gender = (typeof GENDERS)[number];

export interface Patient {
  id: string;
  doctorId: string;
  name: string;
  /** Stored instead of an age, which would go stale. */
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  email: string | null;
  condition: PatientCondition;
  diagnosis: string;
  /** When the patient came under this doctor's care. Drives date filters and statistics. */
  admittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPatient = Pick<
  Patient,
  | 'doctorId'
  | 'name'
  | 'dateOfBirth'
  | 'gender'
  | 'phone'
  | 'email'
  | 'condition'
  | 'diagnosis'
  | 'admittedAt'
>;
export type PatientChanges = Partial<NewPatient>;

export type DoctorSummary = Pick<Doctor, 'id' | 'name' | 'specialization'>;

/** A patient as lists and detail views need it: with their doctor's name. */
export interface PatientWithDoctor extends Patient {
  /** Null only if the doctor record disappeared (should not happen: deletes are guarded). */
  doctor: DoctorSummary | null;
}

/** Business rule: text is trimmed, emails are case-insensitive, blank email means none. */
export function normalizePatient<T extends PatientChanges>(input: T): T {
  return {
    ...input,
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.phone !== undefined && { phone: input.phone.trim() }),
    ...(input.diagnosis !== undefined && { diagnosis: input.diagnosis.trim() }),
    ...(input.email !== undefined && { email: input.email?.trim().toLowerCase() || null }),
  };
}

/** Whole years between the date of birth and `at`. */
export function ageAt(dateOfBirth: Date, at: Date): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed =
    at.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}
