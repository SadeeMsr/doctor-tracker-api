import type { DateRange, Page, PageRequest, SortOrder } from '../shared/pagination.js';

import type { Doctor, DoctorChanges, NewDoctor, Specialization } from './doctor.entity.js';

export type DoctorSortField = 'createdAt' | 'name';

export interface DoctorListCriteria {
  /** Case-insensitive prefix match on name or email. */
  search?: string;
  /** Matches any of these (OR within the filter; filters combine with AND). */
  specialization?: Specialization[];
  /** Matches any of these hospitals. */
  hospital?: string[];
  createdAt?: DateRange;
  sortBy: DoctorSortField;
  sortOrder: SortOrder;
}

/**
 * Persistence port. The application layer depends on this interface only; any database
 * (Mongo, Postgres, in-memory for tests) can implement it.
 *
 * Contract:
 * - Unknown or malformed ids behave like "not found" (null / false), never throw.
 * - A duplicate email throws `ConflictError`.
 */
export interface DoctorRepository {
  create(data: NewDoctor): Promise<Doctor>;
  findById(id: string): Promise<Doctor | null>;
  list(criteria: DoctorListCriteria, page: PageRequest): Promise<Page<Doctor>>;
  update(id: string, changes: DoctorChanges): Promise<Doctor | null>;
  delete(id: string): Promise<boolean>;
  /** Distinct hospital names, sorted, for filter dropdowns. */
  listHospitals(): Promise<string[]>;
}
