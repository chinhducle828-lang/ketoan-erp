/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiNotification.service - AI thông báo thông minh
 * Phân đoạn thông báo, ưu tiên dựa trên ngữ cảnh
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

/**
 * Phân tích độ ưu tiên thông báo
 * @param {string} companyId - ID công ty
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo
 * @returns {Promise<Object>}
 */
export async function analyzeNotificationPriority(companyId, message, type) {
  try {
    // Lấy lịch sử thông báo
    const { rows: history } = await pool.query(
      `SELECT 
        n.type,
        n.priority,
        n.is_read,
        n.created_at
      FROM notifications n
      WHERE n.company_id = $1
      AND n.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY n.created_at DESC
      LIMIT 100`,
      [companyId]
    );

    // Gọi AI service
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/analyze-notification-priority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        message,
        type,
        history
      })
    });

    if (!response.ok) {
      return { priority: 'normal', confidence: 0 };
    }

    const result = await response.json();

    return {
      priority: result.priority || 'normal',
      confidence: result.confidence || 0,
      suggested_channel: result.suggested_channel || 'in_app'
    };
  } catch (error) {
    logger.error({ error: error.message }, 'AI notification priority analysis failed');
    return { priority: 'normal', confidence: 0 };
  }
}

/**
 * Gợi ý thời điểm gửi thông báo
 * @param {string} companyId - ID công ty
 * @param {string} userId - ID người nhận
 * @returns {Promise<Object>}
 */
export async function suggestNotificationTime(companyId, userId) {
  const { rows: userPrefs } = await pool.query(
    `SELECT 
      u.id,
      u.last_login_at,
      u.notification_preferences
    FROM users u
    WHERE u.id = $1 AND u.company_id = $2`,
    [userId, companyId]
  );

  if (userPrefs.length === 0) {
    return { suggested_time: 'now', confidence: 0 };
  }

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/suggest-notification-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: userPrefs[0],
      timezone: 'Asia/Saigon'
    })
  });

  if (!response.ok) {
    return { suggested_time: 'now', confidence: 0 };
  }

  return response.json();
}

/**
 * Tóm tắt thông báo hàng ngày
 * @param {string} companyId - ID công ty
 * @param {string} date - Ngày (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
export async function summarizeDailyNotifications(companyId, date) {
  const { rows: notifications } = await pool.query(
    `SELECT 
      n.type,
      n.message,
      n.priority,
      n.created_at,
      u.full_name as sender
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    WHERE n.company_id = $1
    AND DATE(n.created_at) = $2
    ORDER BY n.priority DESC, n.created_at DESC`,
    [companyId, date]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/summarize-notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: companyId,
      date,
      notifications
    })
  });

  if (!response.ok) {
    return { summary: 'Không thể tóm tắt', count: notifications.length };
  }

  return response.json();
}

export default {
  analyzeNotificationPriority,
  suggestNotificationTime,
  summarizeDailyNotifications
};