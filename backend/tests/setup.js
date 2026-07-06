process.env.KETOAN_TEST = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1';

import { beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  end: jest.fn(),
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  // Any global setup
});

afterAll(async () => {
  try {
    const { pool } = await import('../config/db.js');
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch (error) {
    // Ignore errors closing the test pool; tests are already complete.
  }
});

// ✅ Xuất bằng cú pháp ES Modules chuẩn
export { mockPool };