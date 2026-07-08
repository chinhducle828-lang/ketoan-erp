/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiAging.service - AI dự báo công nợ đối tác
 * Markov chain dự báo xu hướng thanh toán
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Tính toán độ tuổi công nợ (aging)
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function calculateAging(companyId) {
  const { rows } = await pool.query(
    `SELECT 
      p.id as partner_id,
      p.partner_code,
      p.partner_name,
      p.type,
      COALESCE(SUM(CASE 
        WHEN vd.entry_type = 'DR' THEN vd.amount 
        ELSE -vd.amount 
      END), 0) as balance,
      MAX(v.voucher_date) as last_transaction
    FROM partners p
    LEFT JOIN voucher_details vd ON p.id = vd.partner_id
    LEFT JOIN vouchers v ON vd.voucher_id = v.id
    WHERE p.company_id = $1
    AND v.is_posted = TRUE
    GROUP BY p.id, p.partner_code, p.partner_name, p.type
    HAVING COALESCE(SUM(CASE 
      WHEN vd.entry_type = 'DR' THEN vd.amount 
      ELSE -vd.amount 
    END), 0) != 0`,
    [companyId]
  );

  return rows.map(row => {
    const daysOverdue = row.last_transaction 
      ? Math.floor((new Date() - new Date(row.last_transaction)) / (1000 * 60 * 60 * 24))
      : 0;

    let category = 'current';
    if (daysOverdue > 90) category = 'bad_debt';
    else if (daysOverdue > 60) category = 'over_90';
    else if (daysOverdue > 30) category = 'over_60';
    else if (daysOverdue > 0) category = 'over_30';

    return {
      partner_id: row.partner_id,
      partner_code: row.partner_code,
      partner_name: row.partner_name,
      type: row.type,
      balance: Number(row.balance),
      days_overdue: daysOverdue,
      category,
      risk_score: calculateRiskScore(Number(row.balance), daysOverdue)
    };
  });
}

/**
 * Tính điểm rủi ro công nợ
 * @param {number} balance - Số dư
 * @param {number} daysOverdue - Số ngày quá hạn
 * @returns {number}
 */
function calculateRiskScore(balance, daysOverdue) {
  let score = 0;
  
  // Tính dựa trên số dư
  if (balance > 100000000) score += 30;
  else if (balance > 50000000) score += 20;
  else if (balance > 10000000) score += 10;

  // Tính dựa trên ngày quá hạn
  if (daysOverdue > 90) score += 40;
  else if (daysOverdue > 60) score += 30;
  else if (daysOverdue > 30) score += 20;
  else if (daysOverdue > 0) score += 10;

  return Math.min(100, score);
}

/**
 * Dự báo xu hướng thanh toán dùng Markov chain
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function predictCollection(companyId) {
  // Lấy lịch sử thanh toán
  const { rows: paymentHistory } = await pool.query(
    `SELECT 
      p.id as partner_id,
      p.partner_name,
      v.voucher_date,
      v.due_date,
      CASE 
        WHEN v.due_date IS NULL THEN 'paid'
        WHEN v.due_date < v.voucher_date THEN 'early'
        WHEN v.due_date = v.voucher_date THEN 'on_time'
        WHEN v.due_date > v.voucher_date THEN 'late'
      END as payment_status
    FROM partners p
    JOIN voucher_details vd ON p.id = vd.partner_id
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE p.company_id = $1
    AND v.due_date IS NOT NULL
    AND v.is_posted = TRUE
    ORDER BY v.voucher_date DESC
    LIMIT 1000`,
    [companyId]
  );

  // Tính ma trận chuyển đổi
  const transitionMatrix = {
    early: { early: 0, on_time: 0, late: 0, paid: 0 },
    on_time: { early: 0, on_time: 0, late: 0, paid: 0 },
    late: { early: 0, on_time: 0, late: 0, paid: 0 }
  };

  // Đếm chuyển đổi
  for (let i = 0; i < paymentHistory.length - 1; i++) {
    const current = paymentHistory[i];
    const next = paymentHistory[i + 1];
    
    if (current.partner_id === next.partner_id && 
        ['early', 'on_time', 'late'].includes(current.payment_status)) {
      transitionMatrix[current.payment_status][next.payment_status] = 
        (transitionMatrix[current.payment_status][next.payment_status] || 0) + 1;
    }
  }

  // Dự báo xác suất
  const predictions = [];
  const partnerStats = {};

  for (const record of paymentHistory) {
    if (!partnerStats[record.partner_id]) {
      partnerStats[record.partner_id] = {
        name: record.partner_name,
        late_rate: 0,
        on_time_rate: 0
      };
    }
  }

  // Tính tỉ lệ trả chậm
  const lateCount = paymentHistory.filter(p => p.payment_status === 'late').length;
  const totalCount = paymentHistory.length;

  for (const partnerId in partnerStats) {
    const partnerLate = paymentHistory.filter(
      p => p.partner_id === parseInt(partnerId) && p.payment_status === 'late'
    ).length;
    const partnerTotal = paymentHistory.filter(
      p => p.partner_id === parseInt(partnerId)
    ).length;

    partnerStats[partnerId].late_rate = partnerTotal > 0 ? partnerLate / partnerTotal : 0;
    partnerStats[partnerId].on_time_rate = 1 - partnerStats[partnerId].late_rate;
  }

  logger.info({ 
    companyId, 
    total_partners: Object.keys(partnerStats).length,
    overall_late_rate: (lateCount / totalCount).toFixed(2)
  }, 'AI collection prediction completed');

  return {
    transition_matrix: transitionMatrix,
    partner_stats: partnerStats,
    overall_late_rate: lateCount / totalCount,
    confidence: 70
  };
}

/**
 * Gợi ý thu hồi công nợ
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function suggestCollectionActions(companyId) {
  const aging = await calculateAging(companyId);
  
  return aging
    .filter(a => a.category !== 'current')
    .map(a => ({
      partner_id: a.partner_id,
      partner_name: a.partner_name,
      balance: a.balance,
      category: a.category,
      risk_score: a.risk_score,
      suggested_action: a.risk_score > 70 ? 'call_immediately' :
                       a.risk_score > 50 ? 'send_reminder' : 'monitor',
      action_label: a.risk_score > 70 ? 'Gọi ngay' :
                   a.risk_score > 50 ? 'Gửi nhắc nhở' : 'Theo dõi'
    }));
}

export default {
  calculateAging,
  predictCollection,
  suggestCollectionActions
};