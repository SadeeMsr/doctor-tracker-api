import { pino } from 'pino';

import type { IdempotencyStore } from '../../src/application/ports/idempotency-store.js';
import type { Container } from '../../src/container.js';

type Services = Container['services'];
import { createApp } from '../../src/presentation/http/app.js';

import { InMemoryIdempotencyStore } from './in-memory-idempotency-store.js';

interface TestAppDependencies {
  services: Services;
  idempotencyStore?: IdempotencyStore;
  isDatabaseHealthy?: () => boolean;
}

export function buildTestApp({
  services,
  idempotencyStore = new InMemoryIdempotencyStore(),
  isDatabaseHealthy = () => true,
}: TestAppDependencies) {
  return createApp({
    services,
    idempotencyStore,
    logger: pino({ level: 'silent' }),
    isDatabaseHealthy,
    options: {
      corsOrigins: ['http://localhost:3000'],
      trustProxy: 0,
      exposeErrorStack: false,
      secureCookies: false,
    },
  });
}
