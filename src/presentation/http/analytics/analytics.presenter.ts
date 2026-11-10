import type { DashboardSummary } from '../../../application/analytics/analytics.service.js';

/** Response shape for the dashboard. Dates become ISO strings for the charts' axes. */
export function presentSummary(summary: DashboardSummary) {
  return {
    window: { from: summary.window.from.toISOString(), to: summary.window.to.toISOString() },
    interval: summary.interval,
    totals: summary.totals,
    admissionsOverTime: summary.admissionsOverTime.map((bucket) => ({
      periodStart: bucket.periodStart.toISOString(),
      count: bucket.count,
    })),
    conditions: summary.conditions,
    topDoctors: summary.topDoctors,
    specializations: summary.specializations,
  };
}

export type SummaryResponse = ReturnType<typeof presentSummary>;
