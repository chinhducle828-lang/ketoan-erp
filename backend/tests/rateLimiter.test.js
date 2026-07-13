import { jest, describe, expect, test, beforeEach } from '@jest/globals';

const redisMock = {
  status: 'ready',
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
};

await jest.unstable_mockModule('../cache/redis.js', () => ({
  redis: redisMock,
  isRedisReadyCheck: () => redisMock.status === 'ready',
}));

const { apiRateLimiter } = await import('../middleware/rateLimiter.js');

const createReq = (path) => ({
  ip: '203.0.113.10',
  connection: { remoteAddress: '203.0.113.10' },
  method: 'GET',
  path,
});

const createRes = () => ({
  statusCode: 200,
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('apiRateLimiter', () => {
  beforeEach(() => {
    let counts = new Map();
    redisMock.incr.mockImplementation(async (key) => {
      const nextValue = (counts.get(key) || 0) + 1;
      counts.set(key, nextValue);
      return nextValue;
    });
    redisMock.expire.mockResolvedValue(undefined);
    redisMock.ttl.mockResolvedValue(1);
    redisMock.status = 'ready';
  });

  test('keeps different endpoints in separate buckets', async () => {
    const next = jest.fn();

    for (let index = 0; index < 31; index += 1) {
      const res = createRes();
      await apiRateLimiter(createReq('/logistics/queue-details'), res, next);
      if (index < 30) {
        expect(res.status).not.toHaveBeenCalled();
      }
    }

    const secondPathRes = createRes();
    await apiRateLimiter(createReq('/auth/me'), secondPathRes, next);

    expect(secondPathRes.status).not.toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalled();
  });

  test('skips the logistics SSE stream', async () => {
    const next = jest.fn();
    const res = createRes();

    await apiRateLimiter(createReq('/logistics/stream'), res, next);

    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
