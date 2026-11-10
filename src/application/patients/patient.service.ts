import type { DoctorRepository } from '../../domain/doctor/doctor.repository.js';
import {
  normalizePatient,
  type NewPatient,
  type PatientChanges,
  type PatientWithDoctor,
} from '../../domain/patient/patient.entity.js';
import type {
  PatientListCriteria,
  PatientRepository,
} from '../../domain/patient/patient.repository.js';
import { InvalidInputError, NotFoundError } from '../../domain/shared/errors.js';
import type { Page, PageRequest } from '../../domain/shared/pagination.js';

export type NewPatientForDoctor = Omit<NewPatient, 'doctorId'>;

/** Patient use cases, including the doctor-scoped ones used by the doctor detail page. */
export class PatientService {
  readonly #patients: PatientRepository;
  readonly #doctors: DoctorRepository;

  constructor(patients: PatientRepository, doctors: DoctorRepository) {
    this.#patients = patients;
    this.#doctors = doctors;
  }

  list(criteria: PatientListCriteria, page: PageRequest): Promise<Page<PatientWithDoctor>> {
    return this.#patients.list({ ...criteria, search: criteria.search?.trim() || undefined }, page);
  }

  async listForDoctor(
    doctorId: string,
    criteria: Omit<PatientListCriteria, 'doctorId'>,
    page: PageRequest,
  ): Promise<Page<PatientWithDoctor>> {
    await this.#requireDoctor(doctorId);
    return this.list({ ...criteria, doctorId }, page);
  }

  async getById(id: string): Promise<PatientWithDoctor> {
    const patient = await this.#patients.findById(id);
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }

  async createForDoctor(doctorId: string, input: NewPatientForDoctor): Promise<PatientWithDoctor> {
    await this.#requireDoctor(doctorId);
    const patient = await this.#patients.create(normalizePatient({ ...input, doctorId }));
    return this.getById(patient.id);
  }

  async update(id: string, changes: PatientChanges): Promise<PatientWithDoctor> {
    if (changes.doctorId !== undefined && !(await this.#doctors.findById(changes.doctorId))) {
      throw new InvalidInputError('The selected doctor does not exist', [
        { path: 'doctorId', message: 'Doctor not found' },
      ]);
    }
    const patient = await this.#patients.update(id, normalizePatient(changes));
    if (!patient) throw new NotFoundError('Patient');
    return this.getById(patient.id);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.#patients.delete(id))) throw new NotFoundError('Patient');
  }

  async deleteForDoctor(doctorId: string, patientId: string): Promise<void> {
    await this.#requireDoctor(doctorId);
    if (!(await this.#patients.deleteForDoctor(doctorId, patientId))) {
      throw new NotFoundError('Patient');
    }
  }

  async #requireDoctor(doctorId: string): Promise<void> {
    if (!(await this.#doctors.findById(doctorId))) throw new NotFoundError('Doctor');
  }
}
