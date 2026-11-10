export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'Gynecology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Surgery',
  'Urology',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export interface Doctor {
  id: string;
  name: string;
  specialization: Specialization;
  hospital: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewDoctor = Pick<Doctor, 'name' | 'specialization' | 'hospital' | 'phone' | 'email'>;
export type DoctorChanges = Partial<NewDoctor>;

/** Business rule: names/hospitals are trimmed, emails are case-insensitive. */
export function normalizeDoctor<T extends DoctorChanges>(input: T): T {
  return {
    ...input,
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.hospital !== undefined && { hospital: input.hospital.trim() }),
    ...(input.phone !== undefined && { phone: input.phone.trim() }),
    ...(input.email !== undefined && { email: input.email.trim().toLowerCase() }),
  };
}
