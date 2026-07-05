import webPush from 'web-push';

// Initialize VAPID only if keys are provided
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@ketoan-erp.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID keys not configured. Push notifications will not work until configured.');
}

/**
 * Send push notification to a single subscription
 */
export async function sendPushNotification(subscription, payload) {
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired, delete from DB
      await deleteSubscription(subscription.endpoint);
    }
    throw error;
  }
}

/**
 * Send push notification to all subscriptions of a user
 */
export async function sendToUser(userId, notification) {
  const subscriptions = await getSubscriptionsByUser(userId);
  
  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const payload = {
    title: notification.title?.substring(0, 50),
    body: notification.message?.substring(0, 120),
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    data: {
      notificationId: notification.id,
      type: notification.type,
      orderId: notification.order_id,
      url: notification.type === 'order' ? '/logistics' : '/notifications'
    }
  };

  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { success: true, sent, failed };
}

/**
 * Send push notification to all users with a specific role in a company
 */
export async function sendToRole(role, companyId, notification) {
  const subscriptions = await getSubscriptionsByRole(companyId, role);
  
  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const payload = {
    title: notification.title?.substring(0, 50),
    body: notification.message?.substring(0, 120),
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    data: {
      notificationId: notification.id,
      type: notification.type,
      url: '/notifications'
    }
  };

  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { success: true, sent, failed };
}

/**
 * Get all push subscriptions for a user
 */
async function getSubscriptionsByUser(userId) {
  const { pool } = await import('../config/db.js');
  const result = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

/**
 * Get all push subscriptions for users with a specific role in a company
 */
async function getSubscriptionsByRole(companyId, role) {
  const { pool } = await import('../config/db.js');
  const result = await pool.query(`
    SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    JOIN users u ON ps.user_id = u.id
    WHERE ps.company_id = $1 AND u.role = $2
  `, [companyId, role]);
  return result.rows;
}

/**
 * Delete expired subscription
 */
async function deleteSubscription(endpoint) {
  const { pool } = await import('../config/db.js');
  await pool.query(
    'DELETE FROM push_subscriptions WHERE endpoint = $1',
    [endpoint]
  );
}

/**
 * Subscribe to push notifications
 */
export async function subscribe(userId, companyId, subscriptionData) {
  const { pool } = await import('../config/db.js');
  
  const { endpoint, p256dh, auth } = subscriptionData;

  await pool.query(`
    INSERT INTO push_subscriptions (user_id, company_id, endpoint, p256dh, auth)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, endpoint) 
    DO UPDATE SET p256dh = $4, auth = $5, updated_at = NOW()
  `, [userId, companyId, endpoint, p256dh, auth]);

  return { success: true };
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribe(userId, endpoint) {
  const { pool } = await import('../config/db.js');
  
  await pool.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint]
  );

  return { success: true };
}

/**
 * Cleanup expired subscriptions (older than 90 days)
 */
export async function cleanupExpiredSubscriptions() {
  const { pool } = await import('../config/db.js');
  
  const result = await pool.query(`
    DELETE FROM push_subscriptions
    WHERE updated_at < NOW() - INTERVAL '90 days'
    AND user_id NOT IN (
      SELECT user_id FROM sessions WHERE expires_at > NOW()
    )
  `);

  return { deleted: result.rowCount };
}