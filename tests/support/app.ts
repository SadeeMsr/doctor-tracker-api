import { pino } from 'pino';

import type { Services } from '../../src/container.js';
import { createApp } from '../../src/presentation/http/app.js';

export function buildTestApp(services: Services, isDatabaseHealthy = () => true) {
  return createApp({
    services,
    logger: pino({ level: 'silent' }),
    isDatabaseHealthy,
    options: { corsOrigins: ['http://localhost:3000'], trustProxy: 0, exposeErrorStack: false },
  });
}
