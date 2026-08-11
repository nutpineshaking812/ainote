import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    testTimeout: 30000,
    fileParallelism: false,
    include: ['tests/**/*.test.js', '__tests__/**/*.test.js'],
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
