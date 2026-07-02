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

afterAll(() => {
  // Any global teardown
});

// ✅ Xuất bằng cú pháp ES Modules chuẩn
export { mockPool };