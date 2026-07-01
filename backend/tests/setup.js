const { beforeAll, afterAll, beforeEach } = require('@jest/globals');

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

// Setup before all tests
beforeAll(async () => {
  // Setup test database connection if needed
});

// Cleanup after all tests
afterAll(async () => {
  await mockPool.end();
});

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = { mockPool };
