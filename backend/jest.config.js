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
  // Treat .js files as ESM
  extensionsToTreatAsEsm: ['.js'],
};
