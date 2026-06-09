import { defineConfig } from 'vitest/config';

const isWindows = process.platform === 'win32';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    pool: isWindows ? 'threads' : 'forks',
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
