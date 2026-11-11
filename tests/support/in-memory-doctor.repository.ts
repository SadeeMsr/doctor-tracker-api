import type { Doctor, DoctorChanges, NewDoctor } from '../../src/domain/doctor/doctor.entity.js';
import type {
  DoctorListCriteria,
  DoctorRepository,
} from '../../src/domain/doctor/doctor.repository.js';
import { ConflictError } from '../../src/domain/shared/errors.js';
import type { Page, PageRequest } from '../../src/domain/shared/pagination.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

/** Test double proving the application layer runs without any database. */
export class InMemoryDoctorRepository implements DoctorRepository {
  readonly #doctors = new Map<string, Doctor>();
  #sequence = 0;

  #assertUniqueEmail(email: string, exceptId?: string) {
    for (const doctor of this.#doctors.values()) {
      if (doctor.email === email && doctor.id !== exceptId) {
        throw new ConflictError('A doctor with this email already exists', { fields: ['email'] });
      }
    }
  }

  async create(data: NewDoctor): Promise<Doctor> {
    this.#assertUniqueEmail(data.email);
    const now = new Date();
    const id = (++this.#sequence).toString(16).padStart(24, '0');
    const doctor: Doctor = { ...data, id, createdAt: now, updatedAt: now };
    this.#doctors.set(id, doctor);
    return { ...doctor };
  }

  async findById(id: string): Promise<Doctor | null> {
    const doctor = this.#doctors.get(id);
    return doctor ? { ...doctor } : null;
  }

  async list(criteria: DoctorListCriteria, { page, limit }: PageRequest): Promise<Page<Doctor>> {
    const search = criteria.search?.toLowerCase();
    const { from, to } = criteria.createdAt ?? {};

    const matches = [...this.#doctors.values()].filter(
      (doctor) =>
        (!search ||
          doctor.name.toLowerCase().startsWith(search) ||
          doctor.email.startsWith(search)) &&
        (!criteria.specialization?.length ||
          criteria.specialization.includes(doctor.specialization)) &&
        (!criteria.hospital?.length || criteria.hospital.includes(doctor.hospital)) &&
        (!from || doctor.createdAt >= from) &&
        (!to || doctor.createdAt <= to),
    );

    const direction = criteria.sortOrder === 'asc' ? 1 : -1;
    matches.sort((a, b) => {
      const primary =
        criteria.sortBy === 'name'
          ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          : a.createdAt.getTime() - b.createdAt.getTime();
      return (primary || a.id.localeCompare(b.id)) * direction;
    });

    const items = matches.slice((page - 1) * limit, page * limit).map((doctor) => ({ ...doctor }));
    return { items, total: matches.length, page, limit };
  }

  async update(id: string, changes: DoctorChanges): Promise<Doctor | null> {
    const existing = this.#doctors.get(id);
    if (!existing) return null;
    if (changes.email) this.#assertUniqueEmail(changes.email, id);
    const updated: Doctor = { ...existing, ...changes, updatedAt: new Date() };
    this.#doctors.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.#doctors.delete(id);
  }

  async listHospitals(): Promise<string[]> {
    const hospitals = new Set([...this.#doctors.values()].map((doctor) => doctor.hospital));
    return [...hospitals].sort((a, b) => a.localeCompare(b));
  }
}
