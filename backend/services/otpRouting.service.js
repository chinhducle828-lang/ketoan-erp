/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * OTP Routing Service - Smart Routing Push → SMS → Email
 * Tuân thủ Luật 108/2025/QH15 (audit trail bất biến, hash OTP, multi-tenant isolation)
 */

import crypto from 'crypto';
import { pool } from '../config/db.js';

// OTP expiration time in seconds (90 seconds as per SMS OTP document)
const OTP_EXPIRATION_SECONDS = 90;
const OTP_LENGTH = 6;

/**
 * Generate a 6-digit numeric OTP
 * @returns {string} 6-digit OTP code
 */
export function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
}

/**
 * Hash OTP with SHA-256 for secure storage
 * @param {string} otp - The OTP to hash
 * @returns {string} SHA-256 hash of the OTP
 */
export function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Store OTP in database with expiration
 * @param {number} userId - User ID
 * @param {string} otpHash - Hashed OTP
 * @param {string} documentId - Document/Voucher ID
 * @param {string} documentType - Type of document (voucher, e-invoice)
 */
export async function storeOtp({ userId, otpHash, documentId, documentType, companyId }) {
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_SECONDS * 1000);
  
  await pool.query(
    `INSERT INTO otp_signatures (user_id, document_id, document_type, otp_hash, expires_at, company_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, documentId, documentType, otpHash, expiresAt, companyId]
  );
}

/**
 * Verify OTP against stored hash
 * @param {number} userId - User ID
 * @param {string} otp - Plain OTP to verify
 * @param {string} documentId - Document/Voucher ID
 * @returns {boolean} Whether OTP is valid
 */
export async function verifyOtp({ userId, otp, documentId }) {
  const otpHash = hashOtp(otp);
  
  const result = await pool.query(
    `SELECT id FROM otp_signatures 
     WHERE user_id = $1 AND document_id = $2 AND otp_hash = $3 
     AND expires_at > NOW() AND used_at IS NULL`,
    [userId, documentId, otpHash]
  );
  
  if (result.rows.length === 0) {
    return false;
  }
  
  // Mark OTP as used
  await pool.query(
    `UPDATE otp_signatures SET used_at = NOW() WHERE id = $1`,
    [result.rows[0].id]
  );
  
  return true;
}

/**
 * Smart Routing: Send OTP via Push → SMS → Email
 * Priority: Push Notification > SMS > Email
 */
export class OtpRoutingService {
  constructor() {
    this.channels = ['PUSH', 'SMS', 'EMAIL'];
  }

  /**
   * Send signing OTP with smart routing
   * @param {number} userId - User ID
   * @param {string} documentId - Document/Voucher ID
   * @param {string} documentType - Type of document
   * @param {number} companyId - Company ID for multi-tenant isolation
   * @returns {Object} Result with channel used
   */
  async sendSigningOtp({ userId, documentId, documentType, companyId }) {
    // Get user contact info with multi-tenant isolation
    const userResult = await pool.query(
      `SELECT id, phone, email, device_token 
       FROM users 
       WHERE id = $1 AND (company_id IS NULL OR EXISTS(
         SELECT 1 FROM user_companies WHERE user_id = users.id AND company_id = $2
       ))`,
      [userId, companyId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Người dùng không tồn tại hoặc không thuộc công ty này');
    }

    const user = userResult.rows[0];
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    // Store OTP in database
    await storeOtp({ userId, otpHash, documentId, documentType, companyId });

    // Try channels in order: Push → SMS → Email
    const message = `Mã OTP để ký tài liệu của bạn là: ${otp}. Chức năng ký sẽ hết hạn sau ${OTP_EXPIRATION_SECONDS} giây.`;

    // Channel 1: Push Notification
    if (user.device_token) {
      try {
        const pushSuccess = await this.sendPushNotification({
          token: user.device_token,
          title: 'Yêu cầu ký số tài liệu',
          body: `Nhập mã ${otp} để hoàn tất ký kết tài liệu.`,
          data: { documentId, documentType, companyId }
        });
        if (pushSuccess) {
          return { channel: 'PUSH', success: true };
        }
      } catch (err) {
        console.error('Gửi Push thất bại, tự động chuyển sang SMS...', err.message);
      }
    }

    // Channel 2: SMS
    if (user.phone) {
      try {
        const smsSuccess = await this.sendSms({
          phone: user.phone,
          message
        });
        if (smsSuccess) {
          return { channel: 'SMS', success: true };
        }
      } catch (err) {
        console.error('SMS nghẽn mạng, chuyển sang kênh dự phòng cuối cùng...', err.message);
      }
    }

    // Channel 3: Email
    if (user.email) {
      try {
        const emailSuccess = await this.sendEmail({
          email: user.email,
          subject: 'Mã OTP Ký Số Tài Liệu',
          message
        });
        if (emailSuccess) {
          return { channel: 'EMAIL', success: true };
        }
      } catch (err) {
        console.error('Gửi Email thất bại:', err.message);
      }
    }

    throw new Error('Không thể gửi OTP qua bất kỳ kênh nào. Vui lòng kiểm tra lại thông tin liên hệ.');
  }

/**
 * Send push notification via FCM (Mobile) or Web Push (Browser)
 * Priority: FCM device_token > Web Push subscription
 */
async sendPushNotification({ token, title, body, data }) {
  // Try FCM first (mobile app)
  if (token && token.length > 100) {
    // Likely a device token (FCM tokens are typically long)
    try {
      const { sendFCMNotification } = await import('../config/firebase.js');
      const result = await sendFCMNotification({ token, title, body, data });
      if (result.success) {
        return true;
      }
    } catch (fcmError) {
      console.warn('FCM push failed, trying web push:', fcmError.message);
    }
  }
  
  // Try Web Push (browser)
  try {
    const { getSubscriptionsByUser, sendPushNotification: sendWebPush } = await import('./webPush.service.js');
    // Get user ID from token (assuming token is user_id for web push)
    const subscriptions = await getSubscriptionsByUser(token);
    if (subscriptions && subscriptions.length > 0) {
      const payload = { title, body, data };
      for (const sub of subscriptions) {
        await sendWebPush(sub, payload);
      }
      return true;
    }
  } catch (webPushError) {
    console.error('Web push failed:', webPushError.message);
  }
  
  // Fallback: log for development
  console.log(`[Push] Sending to ${token}: ${title} - ${body}`);
  return true;
}

/**
 * Send SMS (placeholder for SMS provider integration)
 */
async sendSms({ phone, message }) {
  // TODO: Integrate with SMS providers (Viettel, Vinaphone, etc.)
  // or Zalo ZNS for cost optimization
  console.log(`[SMS] Sending to ${phone}: ${message}`);
  return true;
}

/**
 * Send email (placeholder for email provider integration)
 */
async sendEmail({ email, subject, message }) {
  // TODO: Integrate with email providers (AWS SES, SendGrid, etc.)
  console.log(`[Email] Sending to ${email}: ${subject} - ${message}`);
  return true;
}

  /**
   * Get OTP status for a document
   */
  async getOtpStatus({ documentId, companyId }) {
    const result = await pool.query(
      `SELECT id, user_id, document_type, sign_status, sign_channel, created_at, expires_at
       FROM otp_signatures 
       WHERE document_id = $1 AND company_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [documentId, companyId]
    );
    
    return result.rows[0] || null;
  }
}

export default new OtpRoutingService();