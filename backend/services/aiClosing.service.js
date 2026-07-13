/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiClosing.service - AI dự báo quyết toán
 * Dự báo sai lệch, cảnh báo rủi ro
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Dự báo quyết toán kế toán
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ kế toán (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictClosing(companyId, period) {
  // Lấy dữ liệu tài khoản
  const { rows: accounts } = await pool.query(
    `SELECT code as account_code, name as account_name, account_type
     FROM accounts 
     WHERE company_id = $1`,
    [companyId]
  );

  // Lấy số dư hiện tại
  const { rows: balances } = await pool.query(
    `SELECT 
      vd.account_code,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
    AND v.is_posted = TRUE
    AND TO_CHAR(v.voucher_date, 'YYYY-MM') = $2
    GROUP BY vd.account_code`,
    [companyId, period]
  );

  // Tính toán dự báo
  const predictions = [];
  const warnings = [];

  for (const account of accounts) {
    const balance = balances.find(b => b.account_code === account.account_code);
    const debit = Number(balance?.debit) || 0;
    const credit = Number(balance?.credit) || 0;
    const netBalance = debit - credit;

    // Dự báo dựa trên xu hướng 3 tháng trước
    const { rows: history } = await pool.query(
      `SELECT 
        EXTRACT(MONTH FROM v.voucher_date) as month,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
      AND vd.account_code = $2
      AND v.is_posted = TRUE
      AND v.voucher_date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY month
      ORDER BY month`,
      [companyId, account.account_code]
    );

    // Tính xu hướng
    let trend = 'stable';
    if (history.length >= 2) {
      const recent = history[history.length - 1];
      const previous = history[history.length - 2];
      const change = ((recent.debit - recent.credit) - (previous.debit - previous.credit)) / ((previous.debit - previous.credit) || 1);
      
      if (change > 0.1) trend = 'increasing';
      else if (change < -0.1) trend = 'decreasing';
    }

    predictions.push({
      account_code: account.account_code,
      account_name: account.account_name,
      current_balance: netBalance,
      trend,
      predicted_end: netBalance * (trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1)
    });

    // Cảnh báo
    if (account.account_type === 'revenue' && trend === 'decreasing') {
      warnings.push({
        type: 'revenue_decline',
        account: account.account_code,
        message: `Doanh thu ${account.account_code} giảm trong tháng ${period}`
      });
    }
  }

  logger.info({ 
    companyId, 
    period, 
    predictions: predictions.length,
    warnings: warnings.length 
  }, 'AI closing prediction completed');

  return {
    period,
    predictions,
    warnings,
    confidence: 85
  };
}

/**
 * Kiểm tra sai lệch khi đóng sổ
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ kế toán
 * @returns {Promise<Object>}
 */
export async function detectClosingAnomalies(companyId, period) {
  // Kiểm tra cân đối sổ sách
  const { rows: trialBalance } = await pool.query(
    `SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
    AND v.is_posted = TRUE
    AND TO_CHAR(v.voucher_date, 'YYYY-MM') = $2`,
    [companyId, period]
  );

  const totalDebit = Number(trialBalance[0]?.total_debit) || 0;
  const totalCredit = Number(trialBalance[0]?.total_credit) || 0;
  const imbalance = Math.abs(totalDebit - totalCredit);

  const anomalies = [];

  if (imbalance > 1000) {
    anomalies.push({
      type: 'trial_balance_imbalance',
      severity: 'critical',
      message: `Sổ cái không cân đối: Nợ ${totalDebit.toLocaleString()} - Có ${totalCredit.toLocaleString()}`,
      amount: imbalance
    });
  }

  // Kiểm tra tài khoản tài chính
  const { rows: financialAccounts } = await pool.query(
    `SELECT 
      vd.account_code,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE -vd.amount END) as net_change
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
    AND v.is_posted = TRUE
    AND TO_CHAR(v.voucher_date, 'YYYY-MM') = $2
    AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
    GROUP BY vd.account_code
    HAVING ABS(SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE -vd.amount END)) > 100000000`,
    [companyId, period]
  );

  for (const acc of financialAccounts) {
    anomalies.push({
      type: 'large_cashflow',
      severity: 'warning',
      message: `Tài khoản ${acc.account_code} có biến động lớn: ${acc.net_change.toLocaleString()}`,
      account_code: acc.account_code
    });
  }

  return {
    period,
    anomalies,
    is_ready_to_close: anomalies.filter(a => a.severity === 'critical').length === 0
  };
}

/**
 * Tạo checklist đóng sổ tự động
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ kế toán
 * @returns {Promise<Array>}
 */
export async function generateClosingChecklist(companyId, period) {
  const [prediction, anomalies] = await Promise.all([
    predictClosing(companyId, period),
    detectClosingAnomalies(companyId, period)
  ]);

  const checklist = [
    {
      id: 1,
      task: 'Kiểm tra sổ cái cân đối',
      status: anomalies.is_ready_to_close ? 'done' : 'pending',
      priority: 'high'
    },
    {
      id: 2,
      task: 'Xác nhận doanh thu',
      status: prediction.warnings.some(w => w.type === 'revenue_decline') ? 'review' : 'done',
      priority: 'high'
    },
    {
      id: 3,
      task: 'Kiểm tra tài khoản ngân hàng',
      status: 'pending',
      priority: 'medium'
    },
    {
      id: 4,
      task: 'Xác nhận công nợ phải thu',
      status: 'pending',
      priority: 'medium'
    }
  ];

  return checklist;
}

export default {
  predictClosing,
  detectClosingAnomalies,
  generateClosingChecklist
};