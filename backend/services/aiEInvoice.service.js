/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiEInvoice.service - AI xác thực hóa đơn điện tử
 * Xác thực tính hợp pháp, phát hiện gian lận
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;
const AI_INTERNAL_SECRET = process.env.AI_INTERNAL_SECRET || '';

/**
 * Xác thực hóa đơn điện tử
 * @param {string} companyId - ID công ty
 * @param {Object} invoiceData - Dữ liệu hóa đơn
 * @returns {Promise<Object>}
 */
export async function verifyEInvoice(companyId, invoiceData) {
  try {
    // Gọi AI service để xác thực
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/verify-einvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
      },
      body: JSON.stringify({
        company_id: companyId,
        invoice: invoiceData
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI e-invoice verification service không phản hồi', 503);
    }

    const result = await response.json();

    // Lưu kết quả xác thực
    await pool.query(
      `INSERT INTO e_invoice_verifications (
        company_id, invoice_number, invoice_data,
        is_valid, confidence_score, verification_details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        companyId,
        invoiceData.invoice_number,
        JSON.stringify(invoiceData),
        result.is_valid,
        result.confidence,
        JSON.stringify(result.details)
      ]
    );

    logger.info({
      companyId,
      invoiceNumber: invoiceData.invoice_number,
      isValid: result.is_valid,
      confidence: result.confidence
    }, 'AI e-invoice verified');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI e-invoice verification service', 503);
  }
}

/**
 * Phát hiện hóa đơn gian lận
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Array>}
 */
export async function detectFraudulentInvoices(companyId, period) {
  const { rows: invoices } = await pool.query(
    `SELECT 
      ei.id,
      ei.invoice_number,
      ei.invoice_data,
      ei.total_amount,
      ei.created_at
    FROM e_invoices ei
    WHERE ei.company_id = $1
    AND DATE_TRUNC('month', ei.created_at) = DATE_TRUNC('month', $2::date)
    AND ei.status = 'active'`,
    [companyId, period]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/detect-fraud`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
    },
    body: JSON.stringify({
      company_id: companyId,
      period,
      invoices
    })
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

/**
 * So sánh hóa đơn giữa nhà cung cấp và khách hàng
 * @param {string} companyId - ID công ty
 * @param {string} partnerId - ID đối tác
 * @returns {Promise<Object>}
 */
export async function reconcileInvoices(companyId, partnerId) {
  const { rows: partnerInvoices } = await pool.query(
    `SELECT 
      ei.invoice_number,
      ei.total_amount,
      ei.created_at,
      ei.status
    FROM e_invoices ei
    WHERE ei.company_id = $1
    AND ei.partner_id = $2
    AND ei.created_at >= NOW() - INTERVAL '90 days'`,
    [companyId, partnerId]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/reconcile-invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
    },
    body: JSON.stringify({
      company_id: companyId,
      partner_id: partnerId,
      invoices: partnerInvoices
    })
  });

  if (!response.ok) {
    return { discrepancies: [] };
  }

  return response.json();
}

export default {
  verifyEInvoice,
  detectFraudulentInvoices,
  reconcileInvoices
};