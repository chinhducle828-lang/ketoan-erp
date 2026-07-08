/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * reportAI.service - AI tạo báo cáo tự động
 * Tự động tạo narrative, phân tích xu hướng
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import { analyzeLedger } from './aiJournal.service.js';
import { predictCashflow } from './aiCashflow.service.js';
import { predictInventoryNeeds } from './aiInventory.service.js';
import logger from '../utils/logger.js';

/**
 * Tạo narrative báo cáo tài chính
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ báo cáo (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function generateFinancialNarrative(companyId, period) {
  // Lấy dữ liệu tài chính
  const [journalAnalysis, cashflow, inventory] = await Promise.all([
    analyzeLedger(companyId, { period: 'month' }),
    predictCashflow(companyId),
    predictInventoryNeeds(companyId)
  ]);

  // Tạo narrative
  const narrative = {
    period,
    executive_summary: `Báo cáo tài chính tháng ${period}: Hệ thống ghi nhận ${journalAnalysis.total_transactions} giao dịch với ${journalAnalysis.anomalies.length} bất thường cần chú ý.`,
    key_metrics: {
      total_transactions: journalAnalysis.total_transactions,
      anomalies_count: journalAnalysis.anomalies.length,
      cash_position: cashflow.current_cash,
      inventory_alerts: inventory.alerts.length
    },
    insights: [],
    recommendations: []
  };

  // Thêm insights từ anomalies
  if (journalAnalysis.anomalies.length > 0) {
    narrative.insights.push({
      type: 'anomaly',
      severity: 'high',
      message: `${journalAnalysis.anomalies.length} giao dịch có số tiền bất thường`
    });
    narrative.recommendations.push('Kiểm tra lại các giao dịch bất thường');
  }

  // Thêm insights từ cashflow
  if (cashflow.alerts.length > 0) {
    narrative.insights.push({
      type: 'cashflow',
      severity: 'critical',
      message: 'Dự báo hụt lương trong tương lai'
    });
    narrative.recommendations.push('Tối ưu hoá quy trình thu tiền');
  }

  // Thêm insights từ inventory
  if (inventory.alerts.length > 0) {
    narrative.insights.push({
      type: 'inventory',
      severity: 'medium',
      message: `${inventory.alerts.length} mặt hàng cần chú ý tồn kho`
    });
    narrative.recommendations.push('Xem xét giảm giá hàng tồn thừa');
  }

  logger.info({ 
    companyId, 
    period,
    insights: narrative.insights.length
  }, 'AI financial narrative generated');

  return narrative;
}

/**
 * Tạo báo cáo xu hướng kinh doanh
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ báo cáo
 * @returns {Promise<Object>}
 */
export async function generateTrendAnalysis(companyId, period) {
  // Lấy dữ liệu 12 tháng
  const { rows } = await pool.query(
    `SELECT 
      TO_CHAR(v.voucher_date, 'YYYY-MM') as month,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.company_id = $1
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY month
    ORDER BY month`,
    [companyId]
  );

  // Tính xu hướng
  const trends = {
    revenue_trend: 'stable',
    expense_trend: 'stable',
    growth_rate: 0
  };

  if (rows.length >= 2) {
    const current = rows[rows.length - 1];
    const previous = rows[rows.length - 2];
    
    const currentNet = Number(current.total_credit) - Number(current.total_debit);
    const previousNet = Number(previous.total_credit) - Number(previous.total_debit);
    
    if (previousNet !== 0) {
      trends.growth_rate = ((currentNet - previousNet) / previousNet * 100).toFixed(1);
    }
  }

  return {
    period,
    monthly_data: rows,
    trends,
    confidence: 75
  };
}

/**
 * Tạo báo cáo so sánh ngành
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function generateBenchmarkReport(companyId) {
  // Lấy dữ liệu công ty
  const { rows: companyData } = await pool.query(
    `SELECT 
      COUNT(*) as total_vouchers,
      SUM(vd.amount) as total_amount
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.company_id = $1
    AND v.is_posted = TRUE
    AND v.voucher_date >= CURRENT_DATE - INTERVAL '1 month'`,
    [companyId]
  );

  // TODO: Tính toán so sánh với trung bình ngành
  // (Cần dữ liệu benchmark từ bảng industry_benchmarks)

  return {
    company_metrics: {
      monthly_volume: Number(companyData[0]?.total_vouchers) || 0,
      monthly_amount: Number(companyData[0]?.total_amount) || 0
    },
    industry_average: {
      monthly_volume: 1000, // Placeholder
      monthly_amount: 500000000 // Placeholder
    },
    performance: 'average' // Placeholder
  };
}

export default {
  generateFinancialNarrative,
  generateTrendAnalysis,
  generateBenchmarkReport
};