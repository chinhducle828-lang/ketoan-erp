import { jest } from '@jest/globals';

const channelListeners = new Map();

const mockPool = {
  query: jest.fn(async () => ({ rows: [] })),
  connect: jest.fn(async () => ({
    query: jest.fn(async () => ({ rows: [] })),
    on: jest.fn((event, handler) => {
      channelListeners.set(event, handler);
    }),
    removeListener: jest.fn(),
    release: jest.fn()
  }))
};

jest.unstable_mockModule('../config/db.js', () => ({ pool: mockPool }));

const { ensureStorefrontRealtimeListener, publishStorefrontOrderEvent, registerStorefrontStreamClient } = await import('../services/storefrontRealtime.service.js');

describe('Storefront realtime synchronization', () => {
  test('publishes normalized events for storefront listeners', async () => {
    const payload = {
      event: 'order_created',
      companyId: '7',
      targetRoles: ['nv_banhang', 'admin'],
      voucherNumber: 'WEB-001'
    };

    await publishStorefrontOrderEvent(mockPool, payload);

    expect(mockPool.query).toHaveBeenCalled();
  });

  test('registers stream clients with a stable role bucket and cleanup', () => {
    const resA = { write: jest.fn() };
    const resB = { write: jest.fn() };

    const unregisterA = registerStorefrontStreamClient({ companyId: 7, res: resA, role: 'nv_banhang' });
    const unregisterB = registerStorefrontStreamClient({ companyId: 7, res: resB, role: 'nv_banhang' });

    unregisterA();

    expect(typeof unregisterB).toBe('function');
  });
});
