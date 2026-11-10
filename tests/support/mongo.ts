import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

import '../../src/infrastructure/database/mongoose/models/index.js';

/** Spins up a throwaway MongoDB for the current test file, with real indexes built. */
export function useMongoMemoryServer(): void {
  let server: MongoMemoryServer;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri('doctor-tracker-test'));
    await mongoose.syncIndexes();
  }, 120_000);

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });
}
