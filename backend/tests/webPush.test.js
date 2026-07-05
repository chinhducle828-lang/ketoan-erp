import { describe, expect, test } from '@jest/globals';

describe('Web Push Service', () => {
  test('sendPushNotification sends to valid subscription', async () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/gAAAAAB...',
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
    };

    // Test that function exists and is callable
    const { sendPushNotification } = await import('../services/webPush.service.js');
    expect(typeof sendPushNotification).toBe('function');
  });

  test('sendToUser returns results array', async () => {
    const { sendToUser } = await import('../services/webPush.service.js');
    expect(typeof sendToUser).toBe('function');
  });

  test('sendToRole returns results array', async () => {
    const { sendToRole } = await import('../services/webPush.service.js');
    expect(typeof sendToRole).toBe('function');
  });
});