import { beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsService } from '../../src/application/analytics/analytics.service.js';
import { InvalidInputError } from '../../src/domain/shared/errors.js';
import { StubAnalyticsQuery } from '../support/stub-analytics-query.js';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Dashboard maths on top of canned aggregate results: no database involved. */
describe('AnalyticsService', () => {
  let query: StubAnalyticsQuery;
  let service: AnalyticsService;

  beforeEach(() => {
    query = new StubAnalyticsQuery();
    service = new AnalyticsService(query);
  });

  it('computes totals, critical count and % change against the previous window', async () => {
    query.admissions = [12, 8];

    const { totals } = await service.getSummary({ interval: 'month' });

    expect(totals).toMatchObject({
      doctors: 4,
      patients: 30,
      criticalPatients: 3,
      admissions: 12,
      previousAdmissions: 8,
      admissionsChange: 50,
    });
  });

  it('always reports every condition, so the chart legend is stable', async () => {
    const { conditions } = await service.getSummary({ interval: 'month' });

    expect(conditions.map((c) => c.condition)).toEqual(
      expect.arrayContaining(['critical', 'stable', 'recovering', 'discharged']),
    );
    expect(conditions.find((c) => c.condition === 'recovering')?.count).toBe(0);
  });

  it('zero-fills the admissions series across the requested window', async () => {
    query.buckets = [{ periodStart: utc('2026-11-02'), count: 4 }];

    const { admissionsOverTime } = await service.getSummary({
      interval: 'day',
      from: utc('2026-11-01'),
      to: utc('2026-11-04'),
    });

    expect(admissionsOverTime.map((b) => b.count)).toEqual([0, 4, 0, 0]);
  });

  it('rejects an inverted range and a series too long to chart', async () => {
    await expect(
      service.getSummary({ interval: 'day', from: utc('2026-11-10'), to: utc('2026-11-01') }),
    ).rejects.toBeInstanceOf(InvalidInputError);
    await expect(
      service.getSummary({ interval: 'day', from: utc('2020-01-01'), to: utc('2026-01-01') }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });
});
