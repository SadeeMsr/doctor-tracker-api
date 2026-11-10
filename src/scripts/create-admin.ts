/**
 * Creates the admin account from SEED_ADMIN_* env vars, or resets its name and password.
 * Idempotent: run it as often as you like (`pnpm db:create-admin`).
 */
import { env, isProduction } from '../config/env.js';
import { buildContainer } from '../container.js';
import {
  connectDatabase,
  disconnectDatabase,
} from '../infrastructure/database/mongoose/connection.js';
import { logger } from '../infrastructure/logging/logger.js';

await connectDatabase({ uri: env.MONGODB_URI, logger, autoIndex: !isProduction });

const { services } = buildContainer();
const admin = await services.users.provisionAccount({
  email: env.SEED_ADMIN_EMAIL,
  name: env.SEED_ADMIN_NAME,
  password: env.SEED_ADMIN_PASSWORD,
});
logger.info({ email: admin.email }, 'Admin account ready');

await disconnectDatabase();
