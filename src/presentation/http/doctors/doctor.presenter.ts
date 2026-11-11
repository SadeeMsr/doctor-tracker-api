import type { DoctorWithStats } from '../../../application/doctors/doctor.service.js';

/** Response shape for a doctor. Decouples the public API from the domain entity. */
export function presentDoctor(doctor: DoctorWithStats) {
  return {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
    hospital: doctor.hospital,
    phone: doctor.phone,
    email: doctor.email,
    patientCount: doctor.patientCount,
    createdAt: doctor.createdAt.toISOString(),
    updatedAt: doctor.updatedAt.toISOString(),
  };
}
