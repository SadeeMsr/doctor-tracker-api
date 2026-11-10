import type {
  AnalyticsQuery,
  DateWindow,
  Interval,
} from '../../application/ports/analytics-query.js';

import { TtlCache } from './ttl-cache.js';

const windowKey = ({ from, to }: DateWindow) => `${from.toISOString()}..${to.toISOString()}`;

/**
 * Decorator: same port, answers repeated dashboard loads from memory for `ttlMs`. The service
 * and the Mongo adapter don't know it exists; only the composition root wires it in.
 */
export class CachedAnalyticsQuery implements AnalyticsQuery {
  readonly #inner: AnalyticsQuery;
  readonly #cache: TtlCache;

  constructor(inner: AnalyticsQuery, { ttlMs }: { ttlMs: number }) {
    this.#inner = inner;
    this.#cache = new TtlCache({ ttlMs });
  }

  countDoctors() {
    return this.#cache.getOrLoad('doctors', () => this.#inner.countDoctors());
  }

  countPatients() {
    return this.#cache.getOrLoad('patients', () => this.#inner.countPatients());
  }

  countAdmissions(window: DateWindow) {
    return this.#cache.getOrLoad(`admissions:${windowKey(window)}`, () =>
      this.#inner.countAdmissions(window),
    );
  }

  countByCondition() {
    return this.#cache.getOrLoad('conditions', () => this.#inner.countByCondition());
  }

  admissionsOverTime(window: DateWindow, interval: Interval) {
    return this.#cache.getOrLoad(`series:${interval}:${windowKey(window)}`, () =>
      this.#inner.admissionsOverTime(window, interval),
    );
  }

  topDoctorsByPatients(limit: number) {
    return this.#cache.getOrLoad(`top:${String(limit)}`, () =>
      this.#inner.topDoctorsByPatients(limit),
    );
  }

  bySpecialization() {
    return this.#cache.getOrLoad('specializations', () => this.#inner.bySpecialization());
  }
}
