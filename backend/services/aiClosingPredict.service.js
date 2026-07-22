/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiClosingPredict.service - AI dự báo khóa sổ
 * Dự báo bút toán khóa sổ dựa trên xu hướng
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;
const AI_INTERNAL_SECRET = process.env.AI_INTERNAL_SECRET || '';

/**
 * Dự báo bút toán khóa sổ
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictClosingEntries(companyId, period) {
  try {
    // Lấy dữ liệu tháng hiện tại
    const { rows: currentData } = await pool.query(
      `SELECT 
        account_code,
        SUM(CASE WHEN entry_type = 'DR' THEN amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN entry_type = 'CR' THEN amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
      AND DATE_TRUNC('month', v.voucher_date) = DATE_TRUNC('month', $2::date)
      GROUP BY account_code`,
      [companyId, period]
    );

    // Lấy dữ liệu lịch sử các tháng trước
    const { rows: historyData } = await pool.query(
      `SELECT 
        account_code,
        EXTRACT(MONTH FROM v.voucher_date) as month,
        SUM(CASE WHEN entry_type = 'DR' THEN amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN entry_type = 'CR' THEN amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
      AND v.voucher_date >= (DATE_TRUNC('month', $2::date) - INTERVAL '12 months')
      GROUP BY account_code, month
      ORDER BY account_code, month`,
      [companyId, period]
    );

    // Gọi AI service để dự báo
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-closing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
      },
      body: JSON.stringify({
        company_id: companyId,
        period,
        current_data: currentData,
        history_data: historyData
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI closing predict service không phản hồi', 503);
    }

    const result = await response.json();

    logger.info({
      companyId,
      period,
      entriesCount: result.entries?.length || 0
    }, 'AI closing entries predicted');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI closing predict service', 503);
  }
}

/**
 * Dự báo chi phí khấu hao
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Array>}
 */
export async function predictDepreciation(companyId, period) {
  const { rows: assets } = await pool.query(
    `SELECT 
      id,
      name,
      purchase_date,
      value,
      depreciation_rate,
      accumulated_depreciation
    FROM items 
    WHERE company_id = $1 
    AND type = 'asset'
    AND is_active = TRUE`,
    [companyId]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-depreciation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
    },
    body: JSON.stringify({
      company_id: companyId,
      period,
      assets
    })
  });

  if (!response.ok) {
    return { error: 'AI service không phản hồi' };
  }

  return response.json();
}

/**
 * Dự báo thuế VAT phải nộp
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictVAT(companyId, period) {
  const { rows: vatData } = await pool.query(
    `SELECT 
      SUM(CASE WHEN v.voucher_type IN ('XK', 'PX') THEN vd.amount ELSE 0 END) as output_vat,
      SUM(CASE WHEN v.voucher_type IN ('NK', 'PN') THEN vd.amount ELSE 0 END) as input_vat
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
    AND DATE_TRUNC('month', v.voucher_date) = DATE_TRUNC('month', $2::date)
    AND vd.account_code LIKE '133%'`,
    [companyId, period]
  );

  return {
    output_vat: Number(vatData[0]?.output_vat) || 0,
    input_vat: Number(vatData[0]?.input_vat) || 0,
    payable: Number(vatData[0]?.output_vat) - Number(vatData[0]?.input_vat)
  };
}

export default {
  predictClosingEntries,
  predictDepreciation,
  predictVAT
};