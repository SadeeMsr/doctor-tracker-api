import {
  normalizeDoctor,
  type Doctor,
  type DoctorChanges,
  type NewDoctor,
} from '../../domain/doctor/doctor.entity.js';
import type {
  DoctorListCriteria,
  DoctorRepository,
} from '../../domain/doctor/doctor.repository.js';
import type { PatientRepository } from '../../domain/patient/patient.repository.js';
import { ConflictError, NotFoundError } from '../../domain/shared/errors.js';
import type { Page, PageRequest } from '../../domain/shared/pagination.js';

export interface DoctorWithStats extends Doctor {
  patientCount: number;
}

/** Doctor use cases. Depends only on repository ports, never on a concrete database. */
export class DoctorService {
  readonly #doctors: DoctorRepository;
  readonly #patients: PatientRepository;

  constructor(doctors: DoctorRepository, patients: PatientRepository) {
    this.#doctors = doctors;
    this.#patients = patients;
  }

  async create(input: NewDoctor): Promise<DoctorWithStats> {
    return { ...(await this.#doctors.create(normalizeDoctor(input))), patientCount: 0 };
  }

  async getById(id: string): Promise<DoctorWithStats> {
    const doctor = await this.#doctors.findById(id);
    if (!doctor) throw new NotFoundError('Doctor');
    return (await this.#withStats([doctor]))[0] ?? { ...doctor, patientCount: 0 };
  }

  async list(criteria: DoctorListCriteria, page: PageRequest): Promise<Page<DoctorWithStats>> {
    const result = await this.#doctors.list(
      { ...criteria, search: criteria.search?.trim() || undefined },
      page,
    );
    return { ...result, items: await this.#withStats(result.items) };
  }

  async update(id: string, changes: DoctorChanges): Promise<DoctorWithStats> {
    const doctor = await this.#doctors.update(id, normalizeDoctor(changes));
    if (!doctor) throw new NotFoundError('Doctor');
    return (await this.#withStats([doctor]))[0] ?? { ...doctor, patientCount: 0 };
  }

  /**
   * Blocked while the doctor still has patients: silently deleting medical records is never
   * what the admin meant. They reassign or remove the patients first.
   */
  async delete(id: string): Promise<void> {
    const patientCount = (await this.#patients.countByDoctorIds([id])).get(id) ?? 0;
    if (patientCount > 0) {
      throw new ConflictError(
        `This doctor still has ${String(patientCount)} patient(s). Reassign or remove them first.`,
        { patientCount },
      );
    }
    if (!(await this.#doctors.delete(id))) throw new NotFoundError('Doctor');
  }

  listHospitals(): Promise<string[]> {
    return this.#doctors.listHospitals();
  }

  /** One grouped count query for the whole page, not one query per doctor. */
  async #withStats(doctors: Doctor[]): Promise<DoctorWithStats[]> {
    const counts = await this.#patients.countByDoctorIds(doctors.map((doctor) => doctor.id));
    return doctors.map((doctor) => ({ ...doctor, patientCount: counts.get(doctor.id) ?? 0 }));
  }
}
