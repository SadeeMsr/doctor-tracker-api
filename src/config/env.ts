import { z } from 'zod';

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'Must be a mongodb:// or mongodb+srv:// URI'),

  /** Comma-separated list of origins allowed to call the API directly (the web app proxies in prod). */
  CORS_ORIGINS: csv.default(['http://localhost:3000']),
  /** Number of reverse proxies in front of the app (Render = 1). Needed for correct client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  /** Signs access tokens. Refresh tokens are opaque random strings, so they need no secret. */
  JWT_ACCESS_SECRET: z.string().min(32, 'Use at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  /** Used by `pnpm db:create-admin` to provision the demo admin account. */
  SEED_ADMIN_EMAIL: z.email().default('admin@doctortracker.dev'),
  SEED_ADMIN_NAME: z.string().trim().min(1).default('Admin'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail fast: a misconfigured server should never boot.
    console.error(`❌ Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
