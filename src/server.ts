import { env, isProduction } from './config/env.js';
import { buildServices } from './container.js';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
} from './infrastructure/database/mongoose/connection.js';
import { logger } from './infrastructure/logging/logger.js';
import { createApp } from './presentation/http/app.js';

async function bootstrap(): Promise<void> {
  await connectDatabase({ uri: env.MONGODB_URI, logger, autoIndex: !isProduction });

  const app = createApp({
    services: buildServices(),
    logger,
    isDatabaseHealthy: isDatabaseConnected,
    options: {
      corsOrigins: env.CORS_ORIGINS,
      trustProxy: env.TRUST_PROXY,
      exposeErrorStack: !isProduction,
    },
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${String(env.PORT)} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);

    // Force-exit if open connections do not drain in time.
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
