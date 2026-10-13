import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    // Every test file shares one test database, so run the files one at a time.
    fileParallelism: false,
    // `npm run test:coverage` reports on our own code, not on the tests themselves.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**'],
    },
    env: {
      // Tests always use a separate database. CI can point at its own with TEST_DATABASE_URL.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://localhost/kitsune_test',
      JWT_SECRET: 'test-only-secret',
      PUBLIC_URL: 'http://localhost:3000',
    },
  },
});
