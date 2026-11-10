import { PATIENT_CONDITIONS, type PatientCondition } from '../../domain/patient/patient.entity.js';
import { InvalidInputError } from '../../domain/shared/errors.js';
import type {
  AnalyticsQuery,
  Bucket,
  DateWindow,
  DoctorCaseload,
  Interval,
  SpecializationStats,
} from '../ports/analytics-query.js';

import { addInterval, bucketStarts, fillBuckets } from './time-buckets.js';

/** Keeps the series small enough to chart and cheap to compute. */
const MAX_BUCKETS: Record<Interval, number> = { day: 366, week: 260, month: 120 };

/** Default window when the client sends no `from`: a sensible amount of history per interval. */
const DEFAULT_SPAN: Record<Interval, number> = { day: 30, week: 12, month: 12 };

const TOP_DOCTORS = 10;

export interface SummaryRequest {
  from?: Date;
  to?: Date;
  interval: Interval;
}

export interface DashboardSummary {
  window: DateWindow;
  interval: Interval;
  totals: {
    doctors: number;
    patients: number;
    criticalPatients: number;
    admissions: number;
    /** Admissions in the equally long window just before this one. */
    previousAdmissions: number;
    /** Percentage change vs the previous window; null when there is nothing to compare with. */
    admissionsChange: number | null;
  };
  admissionsOverTime: Bucket[];
  conditions: { condition: PatientCondition; count: number }[];
  topDoctors: DoctorCaseload[];
  specializations: SpecializationStats[];
}

/**
 * Default `to`. Rounding "now" up to the minute keeps the window (and so the cache key) stable
 * for a minute while still counting everything admitted so far.
 */
function endOfCurrentMinute(): Date {
  const end = new Date();
  end.setUTCSeconds(59, 999);
  return end;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Dashboard statistics: composes independent aggregate queries, run in parallel. */
export class AnalyticsService {
  readonly #query: AnalyticsQuery;

  constructor(query: AnalyticsQuery) {
    this.#query = query;
  }

  async getSummary({
    from,
    to = endOfCurrentMinute(),
    interval,
  }: SummaryRequest): Promise<DashboardSummary> {
    const window = { from: from ?? addInterval(to, interval, -DEFAULT_SPAN[interval]), to };
    this.#assertChartable(window, interval);

    const span = window.to.getTime() - window.from.getTime();
    const previous = { from: new Date(window.from.getTime() - span), to: window.from };

    const [doctors, patients, admissions, previousAdmissions, conditions, series, top, bySpec] =
      await Promise.all([
        this.#query.countDoctors(),
        this.#query.countPatients(),
        this.#query.countAdmissions(window),
        this.#query.countAdmissions(previous),
        this.#query.countByCondition(),
        this.#query.admissionsOverTime(window, interval),
        this.#query.topDoctorsByPatients(TOP_DOCTORS),
        this.#query.bySpecialization(),
      ]);

    // Every condition is always present, so the chart legend is stable.
    const conditionCounts = new Map(conditions.map((row) => [row.condition, row.count]));

    return {
      window,
      interval,
      totals: {
        doctors,
        patients,
        criticalPatients: conditionCounts.get('critical') ?? 0,
        admissions,
        previousAdmissions,
        admissionsChange: percentChange(admissions, previousAdmissions),
      },
      admissionsOverTime: fillBuckets(series, window.from, window.to, interval),
      conditions: PATIENT_CONDITIONS.map((condition) => ({
        condition,
        count: conditionCounts.get(condition) ?? 0,
      })),
      topDoctors: top,
      specializations: bySpec,
    };
  }

  #assertChartable({ from, to }: DateWindow, interval: Interval): void {
    if (from > to) {
      throw new InvalidInputError('`from` must be before `to`', [
        { path: 'from', message: '`from` must be before `to`' },
      ]);
    }
    if (bucketStarts(from, to, interval).length > MAX_BUCKETS[interval]) {
      throw new InvalidInputError(
        `Too many ${interval}s in this range; pick a wider interval or a shorter range`,
        [{ path: 'interval', message: `At most ${String(MAX_BUCKETS[interval])} ${interval}s` }],
      );
    }
  }
}
