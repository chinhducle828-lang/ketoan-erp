import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    exclude: [
      'src/utils/accountingRules.test.js',
      'src/utils/accountingEngine.test.js',
      'src/utils/format.test.js',
    ],
    env: {
      VITE_API_BASE_URL: 'http://localhost:5000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/hooks/**', 'src/components/**'],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50,
        },
      },
    },
  },
});