/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiOcr.service - Service xử lý OCR hóa đơn
 * Tích hợp PaddleOCR/Tesseract + LLM Parser
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';

// Python AI service endpoint
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Gửi file hóa đơn tới AI service để OCR
 * @param {string} fileUrl - URL file hóa đơn
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function processInvoiceOCR(fileUrl, companyId) {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_url: fileUrl, company_id: companyId })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI OCR service không phản hồi', 503);
    }

    const result = await response.json();
    
    logger.info({ 
      companyId, 
      fileUrl,
      confidence: result.confidence_score 
    }, 'AI OCR processed');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI OCR service', 503);
  }
}

/**
 * Lưu kết quả OCR vào database
 * @param {Object} ocrResult - Kết quả OCR
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function saveOCRResult(ocrResult, companyId) {
  const client = await pool.connect();
  try {
    // Tạo voucher nháp với status = 'DRAFT'
    const voucherRes = await client.query(
      `INSERT INTO vouchers (
        company_id, voucher_number, voucher_date, voucher_type,
        description, currency, exchange_rate, created_by, is_posted, hitl_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        companyId,
        ocrResult.invoice_number || '-OCR',
        ocrResult.invoice_date || new Date().toISOString().split('T')[0],
        'XK', // Mặc định là xuất kho
        `Hóa đơn từ AI OCR: ${ocrResult.invoice_number}`,
        ocrResult.currency || 'VND',
        1,
        null, // created_by sẽ được cập nhật khi duyệt
        false,
        'HUMAN_REVIEW' // Luôn cần duyệt khi OCR
      ]
    );

    const voucherId = voucherRes.rows[0].id;

    // Lưu chi tiết định khoản từ AI
    for (const entry of ocrResult.entries || []) {
      await client.query(
        `INSERT INTO voucher_details (
          voucher_id, account_code, entry_type, amount, partner_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          voucherId,
          entry.account_code,
          entry.entry_type,
          entry.amount,
          ocrResult.partner_id || null
        ]
      );
    }

    // Lưu HITL log
    await client.query(
      `INSERT INTO ai_hitl_logs (
        tenant_id, voucher_id, ai_confidence_score, original_ai_proposal,
        final_human_approved, is_modified, processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        companyId,
        voucherId,
        ocrResult.confidence_score,
        JSON.stringify(ocrResult),
        JSON.stringify(ocrResult),
        false,
        'HUMAN_REVIEW'
      ]
    );

    return { voucherId, ocrResult };
  } finally {
    client.release();
  }
}

/**
 * Lấy danh sách hóa đơn cần duyệt
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function getPendingOCRInvoices(companyId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.voucher_number, v.voucher_date, v.description,
            v.hitl_status, v.ai_confidence_score,
            al.original_ai_proposal
     FROM vouchers v
     JOIN ai_hitl_logs al ON v.id = al.voucher_id
     WHERE v.company_id = $1 
     AND v.hitl_status = 'HUMAN_REVIEW'
     ORDER BY v.created_at DESC
     LIMIT 50`,
    [companyId]
  );

  return rows;
}

export default {
  processInvoiceOCR,
  saveOCRResult,
  getPendingOCRInvoices
};