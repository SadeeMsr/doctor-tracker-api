import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Env is validated at import time, so tests get a deterministic config.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/doctor-tracker-test',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
    },
  },
});
