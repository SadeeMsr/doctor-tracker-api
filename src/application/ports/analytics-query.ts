import type { Specialization } from '../../domain/doctor/doctor.entity.js';
import type { DoctorSummary, PatientCondition } from '../../domain/patient/patient.entity.js';

export const INTERVALS = ['day', 'week', 'month'] as const;
export type Interval = (typeof INTERVALS)[number];

export interface DateWindow {
  from: Date;
  to: Date;
}

export interface Bucket {
  /** Start of the bucket in UTC (weeks start on Monday). */
  periodStart: Date;
  count: number;
}

export interface DoctorCaseload {
  doctor: DoctorSummary;
  patients: number;
}

export interface SpecializationStats {
  specialization: Specialization;
  doctors: number;
  patients: number;
}

/**
 * Read-side port for dashboard statistics. Each method is one aggregate query, so the service
 * can run them all in parallel. Implementations must answer from indexes where possible.
 */
export interface AnalyticsQuery {
  countDoctors(): Promise<number>;
  countPatients(): Promise<number>;
  countAdmissions(window: DateWindow): Promise<number>;
  countByCondition(): Promise<{ condition: PatientCondition; count: number }[]>;
  /** Only non-empty buckets; the service fills the gaps with zeros. */
  admissionsOverTime(window: DateWindow, interval: Interval): Promise<Bucket[]>;
  topDoctorsByPatients(limit: number): Promise<DoctorCaseload[]>;
  bySpecialization(): Promise<SpecializationStats[]>;
}
