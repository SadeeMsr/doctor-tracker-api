import { env, isProduction } from './config/env.js';
import { buildContainer } from './container.js';
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
    ...buildContainer(),
    logger,
    isDatabaseHealthy: isDatabaseConnected,
    options: {
      corsOrigins: env.CORS_ORIGINS,
      trustProxy: env.TRUST_PROXY,
      exposeErrorStack: !isProduction,
      secureCookies: isProduction,
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

// Crash-only: after an unexpected failure the process state is unknown, so log and exit and
// let the platform restart a clean instance.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
