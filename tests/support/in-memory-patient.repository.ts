import type {
  NewPatient,
  Patient,
  PatientChanges,
  PatientWithDoctor,
} from '../../src/domain/patient/patient.entity.js';
import type {
  PatientListCriteria,
  PatientRepository,
} from '../../src/domain/patient/patient.repository.js';
import type { Page, PageRequest } from '../../src/domain/shared/pagination.js';

import type { InMemoryDoctorRepository } from './in-memory-doctor.repository.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

/** Test double for patients; joins the doctor summary like the Mongo `$lookup` does. */
export class InMemoryPatientRepository implements PatientRepository {
  readonly #patients = new Map<string, Patient>();
  readonly #doctors: InMemoryDoctorRepository;
  #sequence = 0;

  constructor(doctors: InMemoryDoctorRepository) {
    this.#doctors = doctors;
  }

  async #withDoctor(patient: Patient): Promise<PatientWithDoctor> {
    const doctor = await this.#doctors.findById(patient.doctorId);
    return {
      ...patient,
      doctor: doctor
        ? { id: doctor.id, name: doctor.name, specialization: doctor.specialization }
        : null,
    };
  }

  async create(data: NewPatient): Promise<Patient> {
    const now = new Date();
    const id = `p${(++this.#sequence).toString(16).padStart(23, '0')}`;
    const patient: Patient = { ...data, id, createdAt: now, updatedAt: now };
    this.#patients.set(id, patient);
    return { ...patient };
  }

  async findById(id: string): Promise<PatientWithDoctor | null> {
    const patient = this.#patients.get(id);
    return patient ? this.#withDoctor(patient) : null;
  }

  async list(
    criteria: PatientListCriteria,
    { page, limit }: PageRequest,
  ): Promise<Page<PatientWithDoctor>> {
    const search = criteria.search?.toLowerCase();
    const { from, to } = criteria.admittedAt ?? {};
    const matches = [...this.#patients.values()].filter(
      (patient) =>
        (!search || patient.name.toLowerCase().startsWith(search)) &&
        (!criteria.doctorId || patient.doctorId === criteria.doctorId) &&
        (!criteria.conditions?.length || criteria.conditions.includes(patient.condition)) &&
        (!criteria.gender || patient.gender === criteria.gender) &&
        (!from || patient.admittedAt >= from) &&
        (!to || patient.admittedAt <= to),
    );
    const direction = criteria.sortOrder === 'asc' ? 1 : -1;
    matches.sort((a, b) => (a.admittedAt.getTime() - b.admittedAt.getTime()) * direction);
    const slice = matches.slice((page - 1) * limit, page * limit);
    const items = await Promise.all(slice.map((patient) => this.#withDoctor(patient)));
    return { items, total: matches.length, page, limit };
  }

  async update(id: string, changes: PatientChanges): Promise<Patient | null> {
    const existing = this.#patients.get(id);
    if (!existing) return null;
    const updated: Patient = { ...existing, ...changes, updatedAt: new Date() };
    this.#patients.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.#patients.delete(id);
  }

  async deleteForDoctor(doctorId: string, patientId: string): Promise<boolean> {
    if (this.#patients.get(patientId)?.doctorId !== doctorId) return false;
    return this.#patients.delete(patientId);
  }

  async countByDoctorIds(doctorIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const patient of this.#patients.values()) {
      if (doctorIds.includes(patient.doctorId)) {
        counts.set(patient.doctorId, (counts.get(patient.doctorId) ?? 0) + 1);
      }
    }
    return counts;
  }
}
