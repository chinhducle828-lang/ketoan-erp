import { beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Mock the database pool đầy đủ các phương thức thông dụng của 'pg'
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  end: jest.fn(),
};

// Reset trạng thái của toàn bộ mock function trước mỗi test case độc lập
beforeEach(() => {
  jest.clearAllMocks();
});

beforeAll(() => {
  // Thiết lập môi trường chạy test (ví dụ: gán cứng ENV nếu cần)
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Giải phóng tài nguyên giả lập sau khi hoàn thành toàn bộ suite test
});

// ✅ Xuất bằng cú pháp ES Modules chuẩn
export { mockPool };