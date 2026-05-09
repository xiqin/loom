import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: [
        'src/**/*.js',
        'hooks/**/*.js',
      ],
      exclude: [
        'src/generated/**',
        'scripts/**',
        'tests/**',
        'vitest.config.js',
        'vitest.setup.js',
      ],
    },
  },
});
