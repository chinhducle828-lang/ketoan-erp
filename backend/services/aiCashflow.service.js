/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiCashflow.service - AI dự báo dòng tiền
 * Dự báo cashflow 30 ngày tới, cảnh báo hụt lương
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Dự báo dòng tiền 30 ngày tới
 * @param {string} companyId - ID công ty
 * @param {number} [days=30] - Số ngày dự báo
 * @returns {Promise<Object>}
 */
export async function predictCashflow(companyId, days = 30) {
  // Lấy dữ liệu dòng tiền 90 ngày qua
  const { rows: history } = await pool.query(
    `SELECT 
      DATE(v.voucher_date) as date,
      SUM(CASE 
        WHEN vd.account_code LIKE '111%' OR vd.account_code LIKE '112%' THEN
          CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE -vd.amount END
        ELSE 0 
      END) as net_cash
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.company_id = $1
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(v.voucher_date)
    ORDER BY date`,
    [companyId]
  );

  // Tính xu hướng
  const avgDaily = history.reduce((sum, r) => sum + Number(r.net_cash), 0) / history.length;
  const trend = history.length >= 7 
    ? (history.slice(-7).reduce((sum, r) => sum + Number(r.net_cash), 0) / 7) - avgDaily
    : 0;

  // Dự báo 30 ngày tới
  const predictions = [];
  let cumulative = 0;

  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    // Dự báo dựa trên xu hướng + ngẫu nhiên nhẹ
    const predicted = avgDaily + (trend * 0.1 * Math.sin(i / 10));
    cumulative += predicted;

    predictions.push({
      date: date.toISOString().split('T')[0],
      predicted_cash: Math.round(predicted),
      cumulative: Math.round(cumulative)
    });
  }

  // Lấy số dư hiện tại
  const { rows: currentBalance } = await pool.query(
    `SELECT 
      SUM(CASE 
        WHEN vd.entry_type = 'DR' THEN vd.amount ELSE -vd.amount END
      ) as current_balance
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
    AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
    AND v.is_posted = TRUE`,
    [companyId]
  );

  const currentCash = Number(currentBalance[0]?.current_balance) || 0;

  // Cảnh báo hụt lương
  const alerts = [];
  if (currentCash + cumulative < 0) {
    alerts.push({
      type: 'cash_shortage',
      severity: 'critical',
      message: 'Dự báo hụt lương trong 30 ngày tới',
      predicted_shortage: Math.abs(currentCash + cumulative)
    });
  }

  logger.info({ 
    companyId, 
    days,
    current_cash: currentCash,
    predicted_end: currentCash + cumulative,
    alerts: alerts.length
  }, 'AI cashflow prediction completed');

  return {
    current_cash: currentCash,
    predictions,
    alerts,
    confidence: 75
  };
}

/**
 * Dự báo thu chi dự kiến
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function predictInflowOutflow(companyId) {
  // Dự báo thu dựa trên công nợ phải thu
  const { rows: receivables } = await pool.query(
    `SELECT 
      SUM(vd.amount) as total_receivable,
      COUNT(DISTINCT v.id) as pending_invoices
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
    AND vd.account_code = '131'
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [companyId]
  );

  // Dự báo chi dựa trên công nợ phải trả
  const { rows: payables } = await pool.query(
    `SELECT 
      SUM(vd.amount) as total_payable,
      COUNT(DISTINCT v.id) as pending_bills
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
    AND vd.account_code = '331'
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '30 days'`,
    [companyId]
  );

  return {
    expected_inflow: Number(receivables[0]?.total_receivable) || 0,
    expected_outflow: Number(payables[0]?.total_payable) || 0,
    net_expected: (Number(receivables[0]?.total_receivable) || 0) - (Number(payables[0]?.total_payable) || 0)
  };
}

/**
 * Tối ưu thanh toán nhà cung cấp
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function optimizePaymentSchedule(companyId) {
  const { rows } = await pool.query(
    `SELECT 
      p.id as partner_id,
      p.partner_name,
      SUM(vd.amount) as total_payable,
      MAX(v.due_date) as latest_due
    FROM partners p
    JOIN voucher_details vd ON p.id = vd.partner_id
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE p.company_id = $1
    AND vd.account_code = '331'
    AND v.is_posted = TRUE
    AND v.due_date >= CURRENT_DATE
    GROUP BY p.id, p.partner_name
    ORDER BY v.due_date ASC`,
    [companyId]
  );

  return rows.map(row => ({
    partner_id: row.partner_id,
    partner_name: row.partner_name,
    amount: Number(row.total_payable),
    due_date: row.latest_due,
    priority: Number(row.total_payable) > AI_CONFIG.CASHFLOW.LARGE_TRANSACTION ? 'high' : 'normal'
  }));
}

export default {
  predictCashflow,
  predictInflowOutflow,
  optimizePaymentSchedule
};