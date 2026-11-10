import { ageAt, type PatientWithDoctor } from '../../../domain/patient/patient.entity.js';

/** Response shape for a patient. Decouples the public API from the domain entity. */
export function presentPatient(patient: PatientWithDoctor) {
  return {
    id: patient.id,
    name: patient.name,
    dateOfBirth: patient.dateOfBirth.toISOString(),
    age: ageAt(patient.dateOfBirth, new Date()),
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    condition: patient.condition,
    diagnosis: patient.diagnosis,
    admittedAt: patient.admittedAt.toISOString(),
    doctor: patient.doctor,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  };
}

export type PatientResponse = ReturnType<typeof presentPatient>;
