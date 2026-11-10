import { Router } from 'express';

import type { AnalyticsService } from '../../../application/analytics/analytics.service.js';
import { handle } from '../shared/handle.js';

import { presentSummary } from './analytics.presenter.js';
import { summaryQuery } from './analytics.schemas.js';

/** `/analytics`: one request loads the whole dashboard. */
export function createAnalyticsRouter(analytics: AnalyticsService): Router {
  const router = Router();

  router.get(
    '/summary',
    handle({ query: summaryQuery }, async (req, res) => {
      const summary = await analytics.getSummary(req.query);
      // The browser may reuse it briefly; matches the server-side cache.
      res.set('Cache-Control', 'private, max-age=30');
      res.json({ data: presentSummary(summary) });
    }),
  );

  return router;
}
