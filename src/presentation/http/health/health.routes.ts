import { Router } from 'express';

export function createHealthRouter(isDatabaseHealthy: () => boolean): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const database = isDatabaseHealthy() ? 'up' : 'down';
    res.status(database === 'up' ? 200 : 503).json({
      data: { status: database === 'up' ? 'ok' : 'degraded', database, uptime: process.uptime() },
    });
  });

  return router;
}
