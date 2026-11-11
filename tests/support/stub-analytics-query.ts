import type {
  AnalyticsQuery,
  Bucket,
  DoctorCaseload,
  SpecializationStats,
} from '../../src/application/ports/analytics-query.js';
import type { PatientCondition } from '../../src/domain/patient/patient.entity.js';

// Async on purpose: adapters must reject promises, not throw synchronously.
/* eslint-disable @typescript-eslint/require-await */

/** Canned aggregate answers, so AnalyticsService logic is tested without a database. */
export class StubAnalyticsQuery implements AnalyticsQuery {
  doctors = 4;
  patients = 30;
  /** Admissions in the current window, then in the previous one. */
  admissions: [number, number] = [12, 8];
  conditions: { condition: PatientCondition; count: number }[] = [
    { condition: 'critical', count: 3 },
    { condition: 'stable', count: 27 },
  ];
  buckets: Bucket[] = [];
  #admissionCalls = 0;

  async countDoctors() {
    return this.doctors;
  }
  async countPatients() {
    return this.patients;
  }
  async countAdmissions() {
    return this.admissions[this.#admissionCalls++ % 2] ?? 0;
  }
  async countByCondition() {
    return this.conditions;
  }
  async admissionsOverTime() {
    return this.buckets;
  }
  async topDoctorsByPatients(): Promise<DoctorCaseload[]> {
    return [];
  }
  async bySpecialization(): Promise<SpecializationStats[]> {
    return [];
  }
}
