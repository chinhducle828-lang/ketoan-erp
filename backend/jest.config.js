process.env.KETOAN_TEST = process.env.KETOAN_TEST || '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

export default {
  testEnvironment: 'node',
  verbose: true,
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'validators/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // ESM support
  injectGlobals: true,
  fakeTimers: {
    enableGlobally: true,
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zod|ioredis|jsonwebtoken|bcryptjs|pg)/)',
  ],
};
