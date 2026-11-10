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
import { NotFoundError } from '../../domain/shared/errors.js';
import type { Page, PageRequest } from '../../domain/shared/pagination.js';

/** Doctor use cases. Depends only on the repository port, never on a concrete database. */
export class DoctorService {
  readonly #doctors: DoctorRepository;

  constructor(doctors: DoctorRepository) {
    this.#doctors = doctors;
  }

  create(input: NewDoctor): Promise<Doctor> {
    return this.#doctors.create(normalizeDoctor(input));
  }

  async getById(id: string): Promise<Doctor> {
    const doctor = await this.#doctors.findById(id);
    if (!doctor) throw new NotFoundError('Doctor');
    return doctor;
  }

  list(criteria: DoctorListCriteria, page: PageRequest): Promise<Page<Doctor>> {
    return this.#doctors.list({ ...criteria, search: criteria.search?.trim() || undefined }, page);
  }

  async update(id: string, changes: DoctorChanges): Promise<Doctor> {
    const doctor = await this.#doctors.update(id, normalizeDoctor(changes));
    if (!doctor) throw new NotFoundError('Doctor');
    return doctor;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.#doctors.delete(id);
    if (!deleted) throw new NotFoundError('Doctor');
  }

  listHospitals(): Promise<string[]> {
    return this.#doctors.listHospitals();
  }
}
