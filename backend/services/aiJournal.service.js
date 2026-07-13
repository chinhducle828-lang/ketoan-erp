/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiJournal.service - AI phân tích sổ cái
 * Cognitive Journaling: Phân tích, đề xuất chỉnh sửa
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Phân tích sổ cái, tìm giao dịch bất thường
 * @param {string} companyId - ID công ty
 * @param {Object} options - Tùy chọn
 * @returns {Promise<Object>}
 */
export async function analyzeLedger(companyId, options = {}) {
  const { 
    period = 'month', // 'month', 'quarter', 'year'
    threshold = 0.1 // Ngưỡng bất thường (10%)
  } = options;

  // Lấy dữ liệu sổ cái
  const { rows: ledgerData } = await pool.query(
    `SELECT 
      v.id, v.voucher_date, v.voucher_type, v.description,
      vd.account_code, vd.entry_type, vd.amount
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.company_id = $1 
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '1 month'
    ORDER BY v.voucher_date DESC`,
    [companyId]
  );

  // Phân tích bất thường
  const anomalies = [];
  const accountStats = {};

  for (const row of ledgerData) {
    const key = `${row.account_code}-${row.entry_type}`;
    if (!accountStats[key]) {
      accountStats[key] = { total: 0, count: 0, avg: 0 };
    }
    accountStats[key].total += Number(row.amount);
    accountStats[key].count += 1;
  }

  // Tính trung bình
  for (const key in accountStats) {
    accountStats[key].avg = accountStats[key].total / accountStats[key].count;
  }

  // Tìm giao dịch bất thường
  for (const row of ledgerData) {
    const key = `${row.account_code}-${row.entry_type}`;
    const avg = accountStats[key]?.avg || 0;
    const deviation = Math.abs(Number(row.amount) - avg) / (avg || 1);

    if (deviation > threshold && avg > 100000) {
      anomalies.push({
        voucher_id: row.id,
        account_code: row.account_code,
        amount: row.amount,
        deviation: (deviation * 100).toFixed(1),
        reason: `Số tiền chênh lệch ${((deviation * 100).toFixed(1))}% so với trung bình`
      });
    }
  }

  logger.info({ 
    companyId, 
    total: ledgerData.length, 
    anomalies: anomalies.length 
  }, 'AI journal analysis completed');

  return {
    total_transactions: ledgerData.length,
    anomalies,
    account_stats: accountStats
  };
}

/**
 * Đề xuất chỉnh sửa định khoản
 * @param {number} voucherId - ID chứng từ
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function suggestJournalAdjustments(voucherId, companyId) {
  // Lấy chi tiết chứng từ
  const { rows: voucher } = await pool.query(
    `SELECT v.*, 
      json_agg(json_build_object(
        'accountCode', vd.account_code,
        'entryType', vd.entry_type,
        'amount', vd.amount
      )) as details
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.id = $1 AND v.company_id = $2
    GROUP BY v.id`,
    [voucherId, companyId]
  );

  if (voucher.length === 0) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Không tìm thấy chứng từ', 404);
  }

  const v = voucher[0];
  const totalDebit = (v.details || [])
    .filter(d => d.entryType === 'DR')
    .reduce((sum, d) => sum + Number(d.amount), 0);
  const totalCredit = (v.details || [])
    .filter(d => d.entryType === 'CR')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const suggestions = [];

  // Kiểm tra cân đối
  if (Math.abs(totalDebit - totalCredit) > 1000) {
    suggestions.push({
      type: 'imbalance',
      severity: 'high',
      message: `Chứng từ không cân đối: Nợ ${totalDebit.toLocaleString()} - Có ${totalCredit.toLocaleString()}`,
      suggested_fix: {
        action: 'adjust',
        amount: Math.abs(totalDebit - totalCredit)
      }
    });
  }

  // Kiểm tra tài khoản hợp lệ
  const validAccounts = await pool.query(
    'SELECT code as account_code FROM accounts WHERE company_id = $1',
    [companyId]
  );
  const validCodes = new Set(validAccounts.rows.map(r => r.account_code));

  for (const detail of v.details || []) {
    if (!validCodes.has(detail.accountCode)) {
      suggestions.push({
        type: 'invalid_account',
        severity: 'medium',
        message: `Mã tài khoản ${detail.accountCode} không tồn tại`,
        account_code: detail.accountCode
      });
    }
  }

  return {
    voucher_id: voucherId,
    suggestions,
    confidence: suggestions.length === 0 ? 95 : 70
  };
}

/**
 * Tạo báo cáo AI insights
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function generateAIInsights(companyId) {
  const analysis = await analyzeLedger(companyId);
  
  // Tính toán insights
  const insights = {
    period: '30 ngày qua',
    total_vouchers: analysis.total_transactions,
    anomaly_count: analysis.anomalies.length,
    risk_level: analysis.anomalies.length > 10 ? 'high' : 
                analysis.anomalies.length > 5 ? 'medium' : 'low',
    top_anomalies: analysis.anomalies.slice(0, 5),
    recommendations: []
  };

  // Thêm đề xuất
  if (analysis.anomalies.length > 0) {
    insights.recommendations.push({
      priority: 'high',
      action: 'review_anomalies',
      message: `Có ${analysis.anomalies.length} giao dịch bất thường cần xem xét`
    });
  }

  return insights;
}

export default {
  analyzeLedger,
  suggestJournalAdjustments,
  generateAIInsights
};