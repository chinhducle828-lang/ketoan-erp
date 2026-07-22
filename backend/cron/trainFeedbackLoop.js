/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * trainFeedbackLoop - Cronjob thu thập phản hồi AI hàng tuần
 * Dùng cho RLHF (Reinforcement Learning from Human Feedback)
 */

import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

// Python AI service endpoint (cấu hình qua env)
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 30000; // 30 seconds timeout

/**
 * Fetch with timeout wrapper to prevent hanging connections
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Chạy thu thập phản hồi AI
 * Quét bảng ai_hitl_logs lấy các bộ dữ liệu con người đã sửa
 */
export async function runWeeklyFeedbackCollection(tenantId = null) {
  const client = await pool.connect();
  try {
    // Lấy ra các bộ dữ liệu mà AI đoán sai và con người đã sửa đổi đúng
    let query = `
      SELECT id, tenant_id, voucher_id, ai_confidence_score, 
             original_ai_proposal, final_human_approved, modified_fields
      FROM ai_hitl_logs 
      WHERE is_modified = TRUE 
      AND approved_at >= NOW() - INTERVAL '7 days'
    `;
    
    const params = [];
    if (tenantId) {
      query += ' AND tenant_id = $1';
      params.push(tenantId);
    }

    const { rows } = await client.query(query, params);

    if (rows.length > 0) {
      // Parse JSON string fields to objects before sending to AI service
      const parsedRows = rows.map(row => ({
        ...row,
        original_ai_proposal: typeof row.original_ai_proposal === 'string'
          ? JSON.parse(row.original_ai_proposal)
          : row.original_ai_proposal,
        final_human_approved: typeof row.final_human_approved === 'string'
          ? JSON.parse(row.final_human_approved)
          : row.final_human_approved,
      }));

      // Đẩy tệp log sai lệch này sang Python AI service 
      // dưới dạng "Fine-tuning dataset" để huấn luyện lại bộ gợi ý định khoản
      try {
        const response = await fetchWithTimeout(`${PYTHON_AI_SERVICE_URL}/api/fine-tune`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ training_data: parsedRows })
        });

        if (response.ok) {
          logger.info({ 
            count: rows.length,
            tenantId 
          }, `[SRE RLHF] Đã đẩy thành công ${rows.length} mẫu sửa lỗi của kế toán để cập nhật AI.`);
        } else {
          logger.error({ 
            status: response.status,
            tenantId 
          }, '[SRE RLHF] Lỗi gửi dữ liệu tới Python AI service');
        }
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          logger.error({ 
            tenantId,
            timeout: FETCH_TIMEOUT_MS
          }, '[SRE RLHF] Timeout khi kết nối tới Python AI service');
        } else {
          logger.error({ 
            error: fetchErr.message,
            tenantId 
          }, '[SRE RLHF] Không thể kết nối tới Python AI service');
        }
      }
    } else {
      logger.info({ tenantId }, '[SRE RLHF] Không có dữ liệu sửa lỗi trong 7 ngày qua');
    }

    return { 
      success: true, 
      count: rows.length,
      message: `Processed ${rows.length} feedback records`
    };
  } catch (error) {
    logger.error({ 
      error: error.message,
      tenantId 
    }, '[SRE RLHF] Lỗi thu thập phản hồi học máy');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Chạy định kỳ (hàng ngày)
 */
export async function runDailyFeedbackCollection() {
  // Lấy danh sách tenant
  const { rows: tenants } = await pool.query(
    'SELECT id FROM companies WHERE is_active = TRUE'
  );

  const results = [];
  for (const tenant of tenants) {
    const result = await runWeeklyFeedbackCollection(tenant.id);
    results.push({ tenantId: tenant.id, ...result });
  }

  return results;
}

// Chạy mỗi 24 giờ nếu là main module
let intervalHandle = null;

export function startFeedbackLoopWorker() {
  if (intervalHandle) return;

  // Chạy lần đầu sau 5 phút
  setTimeout(async () => {
    try {
      await runDailyFeedbackCollection();
    } catch (err) {
      logger.error({ error: err.message }, '[SRE RLHF] Lỗi lần chạy đầu');
    }
  }, 5 * 60 * 1000);

  // Chạy mỗi 24 giờ
  intervalHandle = setInterval(async () => {
    try {
      await runDailyFeedbackCollection();
    } catch (err) {
      logger.error({ error: err.message }, '[SRE RLHF] Lỗi chạy định kỳ');
    }
  }, 24 * 60 * 60 * 1000);

  logger.info('[SRE RLHF] Feedback loop worker đã khởi động, chạy mỗi 24 giờ');
}

export function stopFeedbackLoopWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[SRE RLHF] Feedback loop worker đã dừng');
  }
}

// Chạy nếu là main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startFeedbackLoopWorker();
}

export default {
  runWeeklyFeedbackCollection,
  runDailyFeedbackCollection,
  startFeedbackLoopWorker,
  stopFeedbackLoopWorker
};