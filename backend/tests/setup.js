/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Test Setup - Mock Redis and BullMQ for smooth testing
 */

// Mock Redis for testing
jest.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock');
  return RedisMock;
});

// Mock BullMQ for testing
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id', data: {} }),
    process: jest.fn(),
    on: jest.fn(),
    getJob: jest.fn().mockResolvedValue(null),
    getJobs: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Job: jest.fn(),
}));

// Mock node-cache for testing
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
  }));
});

// Global test timeout
jest.setTimeout(30000);