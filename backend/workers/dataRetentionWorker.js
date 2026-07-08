/**
 * Data Retention Worker
 * 
 * Tự động dọn dẹp dữ liệu hết hạn theo quy định:
 * - NĐ 356/2025/NĐ-CP Điều 20: Thời hạn lưu trữ và xóa dữ liệu
 * - Luật BV dữ liệu cá nhân 2025: Quyền xóa dữ liệu (right to be forgotten)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from '../config/db.js';

const DRY_RUN = process.env.KETOAN_TEST === '1' || process.env.NODE_ENV === 'test';

const RETENTION_DAYS = {
  SESSION_EXPIRE: 90,         // Session hết hạn sau 90 ngày
  PUSH_SUBSCRIPTION: 90,       // Push subscription không hoạt động 90 ngày
  AUDIT_LOG: 365,             // Audit log lưu tối thiểu 1 năm
  CONSENT_EXPIRE: 3650,       // Consent lưu tối đa 10 năm (theo quy định thuế)
  COMPLAINT_EXPIRE: 365,      // Khiếu nại lưu 1 năm
  REFUND_EXPIRE: 3650,        // Yêu cầu hoàn tiền lưu 10 năm
};

/**
 * Xóa các session đã hết hạn
 */
async function cleanupExpiredSessions() {
  const result = await pool.query(
    `DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '${RETENTION_DAYS.SESSION_EXPIRE} days'`
  );
  if (result.rowCount > 0) {
    console.log(`[DataRetention] Đã xóa ${result.rowCount} session hết hạn`);
  }
  return result.rowCount;
}

/**
 * Ẩn danh hóa dữ liệu người dùng đã request xóa (theo quyền bị lãng quên)
 * Những user có preferences = NULL và company_ids = NULL là user đã yêu cầu xóa
 */
async function anonymizeDeletedUsers() {
  const result = await pool.query(`
    UPDATE users 
    SET username = 'deleted_user_' || id,
        password = '',
        preferences = '{"anonymized": true, "deleted_at": "' || NOW()::text || '"}',
        staff_ids = '{}'
    WHERE company_ids IS NULL 
      AND is_root_admin = false
      AND preferences IS NULL
      AND created_at < NOW() - INTERVAL '30 days'
    RETURNING id
  `);
  if (result.rows.length > 0) {
    console.log(`[DataRetention] Đã ẩn danh hóa ${result.rows.length} tài khoản đã xóa`);
  }
  return result.rows.length;
}

/**
 * Xóa push subscription không hoạt động (90 ngày)
 */
async function cleanupStalePushSubscriptions() {
  const result = await pool.query(
    `DELETE FROM push_subscriptions WHERE updated_at < NOW() - INTERVAL '${RETENTION_DAYS.PUSH_SUBSCRIPTION} days'`
  );
  if (result.rowCount > 0) {
    console.log(`[DataRetention] Đã xóa ${result.rowCount} đăng ký push hết hạn`);
  }
  return result.rowCount;
}

/**
 * Xóa các bản ghi audit log cũ (hơn 1 năm)
 */
async function cleanupOldAuditLogs() {
  const result = await pool.query(
    `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS.AUDIT_LOG} days'`
  );
  if (result.rowCount > 0) {
    console.log(`[DataRetention] Đã xóa ${result.rowCount} audit log cũ`);
  }
  return result.rowCount;
}

/**
 * Xóa các khiếu nại đã xử lý quá hạn lưu trữ
 */
async function cleanupOldComplaints() {
  const result = await pool.query(
    `DELETE FROM complaints WHERE status = 'resolved' 
     AND created_at < NOW() - INTERVAL '${RETENTION_DAYS.COMPLAINT_EXPIRE} days'`
  );
  if (result.rowCount > 0) {
    console.log(`[DataRetention] Đã xóa ${result.rowCount} khiếu nại cũ`);
  }
  return result.rowCount;
}

/**
 * Chạy tất cả các tác vụ dọn dẹp
 */
export async function runDataRetention() {
  if (DRY_RUN) {
    console.log('[DataRetention] DRY RUN mode - không thực hiện xóa thật');
    return { dryRun: true };
  }

  console.log('[DataRetention] Bắt đầu dọn dẹp dữ liệu...');
  const results = {
    sessions: await cleanupExpiredSessions(),
    anonymized: await anonymizeDeletedUsers(),
    pushSubscriptions: await cleanupStalePushSubscriptions(),
    auditLogs: await cleanupOldAuditLogs(),
    complaints: await cleanupOldComplaints(),
  };
  console.log('[DataRetention] Hoàn tất:', JSON.stringify(results));
  return results;
}

// Chạy mỗi 24 giờ nếu là main module
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
let intervalHandle = null;

export function startDataRetentionWorker() {
  if (intervalHandle) return;
  
  // Chạy lần đầu sau 5 phút
  setTimeout(async () => {
    try {
      await runDataRetention();
    } catch (err) {
      console.error('[DataRetention] Lỗi lần chạy đầu:', err.message);
    }
  }, 5 * 60 * 1000);

  intervalHandle = setInterval(async () => {
    try {
      await runDataRetention();
    } catch (err) {
      console.error('[DataRetention] Lỗi định kỳ:', err.message);
    }
  }, RUN_INTERVAL_MS);

  console.log(`[DataRetention] Worker đã khởi tạo, chạy mỗi ${RUN_INTERVAL_MS / 3600000} giờ`);
}

export function stopDataRetentionWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[DataRetention] Worker đã dừng');
  }
}

export default { runDataRetention, startDataRetentionWorker, stopDataRetentionWorker };