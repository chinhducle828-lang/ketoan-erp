/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from '../config/db.js';
import { sendToUser, sendToRole, subscribe, unsubscribe } from '../services/webPush.service.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { getIO } from '../services/websocket.service.js';

// POST /api/notifications/subscribe
export const subscribeToPush = async (req, res) => {
  try {
    const { endpoint, p256dh, auth } = req.body;
    const userId = req.user.id;
    const companyId = req.body.companyId || req.user.company_ids?.[0];

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Thiếu thông tin subscription' });
    }

    await subscribe(userId, companyId, { endpoint, p256dh, auth });

    res.json({ success: true, message: 'Đăng ký nhận thông báo thành công' });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/notifications/unsubscribe
export const unsubscribeFromPush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;

    await unsubscribe(userId, endpoint);

    res.json({ success: true, message: 'Hủy đăng ký thành công' });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.query.company_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    // Get notifications for the company
    let query = `
      SELECT * FROM notifications 
      WHERE company_id = $1
    `;
    
    const params = [companyId];

    // If not admin, filter by recipient_role
    if (req.user.role !== 'admin') {
      query += ` AND (recipient_role = $2 OR recipient_role IS NULL)`;
      params.push(req.user.role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Get unread count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE company_id = $1 AND is_read = FALSE
    `;
    const countResult = await pool.query(countQuery, [companyId]);

    res.json({ 
      success: true, 
      data: result.rows,
      unreadCount: parseInt(countResult.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE id = $1
    `, [notificationId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.query.company_id;

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    let query = `
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE company_id = $1 AND is_read = FALSE
    `;
    const params = [companyId];

    // Nếu không phải admin, chỉ đánh dấu đọc các notification thuộc role của họ
    if (req.user.role !== 'admin') {
      query += ` AND (recipient_role = $2 OR recipient_role IS NULL)`;
      params.push(req.user.role);
    }

    await pool.query(query, params);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/notifications/send (admin only)
export const sendNotification = async (req, res) => {
  try {
    const { title, message, type, recipientRole, companyId } = req.body;

    if (!title || !message || !companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    // Save notification to DB
    const result = await pool.query(`
      INSERT INTO notifications (company_id, type, title, message, recipient_role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [companyId, type || 'general', title, message, recipientRole]);

    const notification = result.rows[0];

    // Send WebSocket realtime event
    const io = getIO();
    if (io) {
      if (recipientRole) {
        io.to(`role:${recipientRole}`).emit('notification:new', notification);
      }
      io.to(`company:${companyId}`).emit('notification:new', notification);
    }

    // Send push notification (non-blocking)
    if (recipientRole) {
      sendToRole(recipientRole, companyId, notification).catch(err => 
        console.warn('Push notification failed:', err)
      );
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/notifications/send-to-user
export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, message, type, orderId } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    // Save notification to DB
    const result = await pool.query(`
      INSERT INTO notifications (company_id, order_id, type, title, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.company_ids?.[0], orderId || null, type || 'general', title, message]);

    const notification = result.rows[0];

    // Send WebSocket realtime event to company room
    const io = getIO();
    if (io) {
      io.to(`company:${notification.company_id}`).emit('notification:new', notification);
    }

    // Send push notification (non-blocking)
    sendToUser(userId, notification).catch(err => 
      console.warn('Push notification failed:', err)
    );

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({ error: error.message });
  }
};
