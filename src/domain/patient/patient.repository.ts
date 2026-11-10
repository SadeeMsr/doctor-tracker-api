import type { DateRange, Page, PageRequest, SortOrder } from '../shared/pagination.js';

import type {
  Gender,
  NewPatient,
  Patient,
  PatientChanges,
  PatientCondition,
  PatientWithDoctor,
} from './patient.entity.js';

export type PatientSortField = 'admittedAt' | 'name' | 'createdAt';

export interface PatientListCriteria {
  /** Case-insensitive prefix match on the patient's name. */
  search?: string;
  doctorId?: string;
  /** Any of these conditions. */
  conditions?: PatientCondition[];
  gender?: Gender;
  admittedAt?: DateRange;
  sortBy: PatientSortField;
  sortOrder: SortOrder;
}

/**
 * Persistence port for patients.
 *
 * Contract:
 * - Unknown or malformed ids behave like "not found" (null / false / empty), never throw.
 * - `list` and `findById` include the doctor summary.
 */
export interface PatientRepository {
  create(data: NewPatient): Promise<Patient>;
  findById(id: string): Promise<PatientWithDoctor | null>;
  list(criteria: PatientListCriteria, page: PageRequest): Promise<Page<PatientWithDoctor>>;
  update(id: string, changes: PatientChanges): Promise<Patient | null>;
  delete(id: string): Promise<boolean>;
  /** Deletes the patient only if it belongs to that doctor. */
  deleteForDoctor(doctorId: string, patientId: string): Promise<boolean>;
  /** Patient count per doctor id; doctors without patients are absent from the map. */
  countByDoctorIds(doctorIds: string[]): Promise<Map<string, number>>;
}
