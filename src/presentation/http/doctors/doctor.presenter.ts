import type { Doctor } from '../../../domain/doctor/doctor.entity.js';

/** Response shape for a doctor. Decouples the public API from the domain entity. */
export function presentDoctor(doctor: Doctor) {
  return {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}

export type DoctorResponse = ReturnType<typeof presentDoctor>;
