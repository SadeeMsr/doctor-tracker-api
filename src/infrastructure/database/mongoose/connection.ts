import mongoose from 'mongoose';

import type { Logger } from '../../logging/logger.js';

// Reject filters on fields that are not in the schema instead of silently ignoring them.
mongoose.set('strictQuery', true);

interface ConnectOptions {
  uri: string;
  logger: Logger;
  /** Build indexes on model init. Off in production, where `db:sync-indexes` runs explicitly. */
  autoIndex: boolean;
}

export async function connectDatabase({ uri, logger, autoIndex }: ConnectOptions): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });

  await mongoose.connect(uri, { autoIndex, serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
