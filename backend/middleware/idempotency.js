/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * idempotency.js - Middleware ngăn chặn xử lý trùng lặp sự kiện
 * Đảm bảo mỗi event chỉ được xử lý 1 lần duy nhất
 */

import { pool } from '../config/db.js';

/**
 * Middleware kiểm tra idempotency key
 * Client gửi header: X-Idempotency-Key: <unique-key>
 * 
 * Flow:
 * 1. Check if key exists in DB
 * 2. If exists and status = 'completed' → return cached result
 * 3. If exists and status = 'processing' → return 409 Conflict
 * 4. If not exists → create new record with status = 'processing', call next()
 */

export const checkIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  const companyId = req.body?.companyId || req.params?.companyId;
  const eventType = req.body?.eventType || req.params?.eventType;

  // Nếu không có idempotency key, cho phép xử lý bình thường
  if (!idempotencyKey || !companyId || !eventType) {
    return next();
  }

  try {
    // 1. Kiểm tra key đã tồn tại chưa
    const existing = await pool.query(
      `SELECT id, status, result FROM idempotency_keys 
       WHERE company_id = $1 AND event_type = $2 AND idempotency_key = $3`,
      [companyId, eventType, idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const record = existing.rows[0];

      // 2. Nếu đã completed → trả về kết quả cached
      if (record.status === 'completed') {
        return res.status(200).json({
          success: true,
          cached: true,
          data: record.result
        });
      }

      // 3. Nếu đang processing → trả về 409 Conflict
      if (record.status === 'processing') {
        return res.status(409).json({
          success: false,
          message: 'Sự kiện đang được xử lý. Vui lòng không gửi lại yêu cầu.',
          errorCode: 'IDEMPOTENT_PROCESSING'
        });
      }

      // 4. Nếu failed → cho phép retry (xóa record cũ)
      if (record.status === 'failed') {
        await pool.query(
          'DELETE FROM idempotency_keys WHERE id = $1',
          [record.id]
        );
      }
    }

    // 5. Tạo record mới với status = 'processing'
    await pool.query(
      `INSERT INTO idempotency_keys (company_id, event_type, idempotency_key, status)
       VALUES ($1, $2, $3, 'processing')`,
      [companyId, eventType, idempotencyKey]
    );

    // Lưu record ID vào req để sử dụng sau khi xử lý xong
    req.idempotencyRecordId = existing.rows[0]?.id || null;

    next();
  } catch (error) {
    console.error('Idempotency check error:', error);
    // Nếu lỗi DB, vẫn cho phép xử lý (fail-open)
    next();
  }
};

/**
 * Middleware đánh dấu idempotency key là completed
 * Gọi sau khi xử lý event thành công
 */
export const markIdempotencyCompleted = async (req, result) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  const companyId = req.body?.companyId || req.params?.companyId;
  const eventType = req.body?.eventType || req.params?.eventType;

  if (!idempotencyKey || !companyId || !eventType) {
    return;
  }

  try {
    await pool.query(
      `UPDATE idempotency_keys 
       SET status = 'completed', result = $1, completed_at = NOW()
       WHERE company_id = $2 AND event_type = $3 AND idempotency_key = $4`,
      [result, companyId, eventType, idempotencyKey]
    );
  } catch (error) {
    console.error('Mark idempotency completed error:', error);
  }
};

/**
 * Middleware đánh dấu idempotency key là failed
 * Gọi khi xử lý event thất bại
 */
export const markIdempotencyFailed = async (req, errorMessage) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  const companyId = req.body?.companyId || req.params?.companyId;
  const eventType = req.body?.eventType || req.params?.eventType;

  if (!idempotencyKey || !companyId || !eventType) {
    return;
  }

  try {
    await pool.query(
      `UPDATE idempotency_keys 
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE company_id = $2 AND event_type = $3 AND idempotency_key = $4`,
      [errorMessage, companyId, eventType, idempotencyKey]
    );
  } catch (error) {
    console.error('Mark idempotency failed error:', error);
  }
};

/**
 * Cleanup job: Xóa các idempotency keys cũ (completed/failed) sau 30 ngày
 * Gọi từ cron job hoặc scheduled task
 */
export const cleanupOldIdempotencyKeys = async () => {
  try {
    const result = await pool.query(
      `DELETE FROM idempotency_keys 
       WHERE status IN ('completed', 'failed') 
       AND created_at < NOW() - INTERVAL '30 days'`
    );
    
    console.log(`[Idempotency] Cleaned up ${result.rowCount} old records`);
    return result.rowCount;
  } catch (error) {
    console.error('Idempotency cleanup error:', error);
    return 0;
  }
};