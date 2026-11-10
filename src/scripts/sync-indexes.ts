/**
 * Builds/drops indexes so they match the schemas. Production disables `autoIndex`, so run
 * this on deploy: `pnpm db:sync-indexes`.
 */
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
} from '../infrastructure/database/mongoose/connection.js';
import { logger } from '../infrastructure/logging/logger.js';
import '../infrastructure/database/mongoose/models/index.js';

await connectDatabase({ uri: env.MONGODB_URI, logger, autoIndex: false });
const result = await mongoose.syncIndexes();
logger.info({ result }, 'Indexes synced');
await disconnectDatabase();
