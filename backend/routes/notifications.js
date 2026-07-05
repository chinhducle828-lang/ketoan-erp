import express from 'express';
import { 
  subscribeToPush, 
  unsubscribeFromPush, 
  getNotifications, 
  markAsRead, 
  markAllAsRead,
  sendNotification,
  sendNotificationToUser
} from '../controllers/notification.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Subscribe to push notifications
router.post('/subscribe', subscribeToPush);

// Unsubscribe from push notifications
router.post('/unsubscribe', unsubscribeFromPush);

// Get notifications list
router.get('/', getNotifications);

// Mark notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Send notification to role (admin only)
router.post('/send', requireRole(['admin']), sendNotification);

// Send notification to specific user (admin only)
router.post('/send-to-user', requireRole(['admin']), sendNotificationToUser);

export default router;