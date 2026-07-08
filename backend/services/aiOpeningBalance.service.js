/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiOpeningBalance.service - AI gợi ý số dư đầu kỳ
 * Dựa trên lịch sử giao dịch và xu hướng
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

/**
 * Dự đoán số dư đầu kỳ dựa trên lịch sử
 * @param {string} companyId - ID công ty
 * @param {string} accountCode - Mã tài khoản
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictOpeningBalance(companyId, accountCode, period) {
  try {
    // Lấy dữ liệu lịch sử 3 tháng gần nhất
    const { rows: historyRows } = await pool.query(
      `SELECT 
        account_code,
        SUM(CASE WHEN entry_type = 'DR' THEN amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN entry_type = 'CR' THEN amount ELSE 0 END) as total_credit,
        COUNT(*) as transaction_count
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
      AND v.voucher_date >= (DATE_TRUNC('month', $2::date) - INTERVAL '3 months')
      AND v.voucher_date < DATE_TRUNC('month', $2::date)
      GROUP BY account_code
      ORDER BY account_code`,
      [companyId, period]
    );

    // Tính toán xu hướng
    const accountHistory = historyRows.filter(r => r.account_code === accountCode);
    
    if (accountHistory.length === 0) {
      return {
        account_code: accountCode,
        predicted_balance: 0,
        confidence: 0,
        suggestion: 'Không có dữ liệu lịch sử'
      };
    }

    // Gọi AI service để dự đoán
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-opening-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        account_code: accountCode,
        period,
        history: accountHistory
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI opening balance service không phản hồi', 503);
    }

    const result = await response.json();

    logger.info({
      companyId,
      accountCode,
      period,
      predicted: result.predicted_balance
    }, 'AI opening balance predicted');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI opening balance service', 503);
  }
}

/**
 * Lấy gợi ý số dư đầu kỳ hàng loạt
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Array>}
 */
export async function getOpeningBalanceSuggestions(companyId, period) {
  const { rows: accounts } = await pool.query(
    `SELECT DISTINCT account_code 
     FROM voucher_details vd
     JOIN vouchers v ON vd.voucher_id = v.id
     WHERE v.company_id = $1 
     AND v.voucher_date >= (DATE_TRUNC('month', $2::date) - INTERVAL '6 months')`,
    [companyId, period]
  );

  const suggestions = [];
  for (const acc of accounts) {
    const suggestion = await predictOpeningBalance(companyId, acc.account_code, period);
    suggestions.push(suggestion);
  }

  return suggestions;
}

export default {
  predictOpeningBalance,
  getOpeningBalanceSuggestions
};