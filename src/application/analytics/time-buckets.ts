import type { Bucket, Interval } from '../ports/analytics-query.js';

/** Start of the UTC day/week (Monday)/month containing `date`. Mirrors Mongo's `$dateTrunc`. */
function truncateUtc(date: Date, interval: Interval): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (interval === 'week') {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  }
  if (interval === 'month') start.setUTCDate(1);
  return start;
}

export function addInterval(date: Date, interval: Interval, amount = 1): Date {
  const next = new Date(date);
  if (interval === 'day') next.setUTCDate(next.getUTCDate() + amount);
  if (interval === 'week') next.setUTCDate(next.getUTCDate() + 7 * amount);
  if (interval === 'month') next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}

/** Every bucket start from `from` to `to`, inclusive. */
export function bucketStarts(from: Date, to: Date, interval: Interval): Date[] {
  const starts: Date[] = [];
  for (
    let cursor = truncateUtc(from, interval);
    cursor <= to;
    cursor = addInterval(cursor, interval)
  ) {
    starts.push(cursor);
  }
  return starts;
}

/** Charts need a continuous axis: periods without admissions become explicit zeros. */
export function fillBuckets(buckets: Bucket[], from: Date, to: Date, interval: Interval): Bucket[] {
  const counts = new Map(buckets.map((bucket) => [bucket.periodStart.getTime(), bucket.count]));
  return bucketStarts(from, to, interval).map((periodStart) => ({
    periodStart,
    count: counts.get(periodStart.getTime()) ?? 0,
  }));
}
