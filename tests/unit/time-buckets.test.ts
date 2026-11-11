import { describe, expect, it } from 'vitest';

import { bucketStarts, fillBuckets } from '../../src/application/analytics/time-buckets.js';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Chart axes: buckets must match Mongo's `$dateTrunc` and have no gaps. */
describe('time buckets', () => {
  it('starts weeks on Monday (UTC), like $dateTrunc', () => {
    // 2026-11-11 is a Wednesday.
    const [first] = bucketStarts(utc('2026-11-11'), utc('2026-11-20'), 'week');

    expect(first?.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(first?.getUTCDay()).toBe(1);
  });

  it('starts months on the 1st', () => {
    const starts = bucketStarts(utc('2026-01-15'), utc('2026-03-02'), 'month');

    expect(starts.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('fills days without admissions with explicit zeros', () => {
    const filled = fillBuckets(
      [{ periodStart: utc('2026-11-02'), count: 5 }],
      utc('2026-11-01'),
      utc('2026-11-03'),
      'day',
    );

    expect(filled.map((b) => b.count)).toEqual([0, 5, 0]);
  });
});
