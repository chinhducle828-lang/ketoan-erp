process.env.KETOAN_TEST = process.env.KETOAN_TEST || '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

export default {
  testEnvironment: 'node',
  verbose: true,
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.stryker-tmp/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'validators/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './validators/index.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './services/taxRule.service.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './services/closing.service.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './utils/accountingEngine.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // ESM support
  injectGlobals: true,
  fakeTimers: {
    enableGlobally: true,
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zod|ioredis|jsonwebtoken|bcryptjs|pg)/)',
  ],
};
