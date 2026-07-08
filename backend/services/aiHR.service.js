/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiHR.service - AI dự báo HR
 * Dự báo lương, phân tích KPI nhân viên
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

/**
 * Dự báo chi phí lương
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictSalaryCost(companyId, period) {
  try {
    // Lấy dữ liệu nhân viên
    const { rows: employees } = await pool.query(
      `SELECT 
        u.id,
        u.full_name,
        u.salary_base,
        u.salary_coefficient,
        COALESCE(SUM(p.working_days), 0) as working_days,
        COALESCE(SUM(p.overtime_hours), 0) as overtime_hours
      FROM users u
      LEFT JOIN payroll p ON u.id = p.user_id
      WHERE u.company_id = $1
      AND u.role IN ('nv', 'nv_banhang', 'nv_kho')
      AND (p.period = $2 OR p.period IS NULL)
      GROUP BY u.id, u.full_name, u.salary_base, u.salary_coefficient`,
      [companyId, period]
    );

    // Lấy lịch sử lương
    const { rows: history } = await pool.query(
      `SELECT 
        user_id,
        period,
        total_salary,
        created_at
      FROM payroll
      WHERE company_id = $1
      AND created_at >= (DATE_TRUNC('month', $2::date) - INTERVAL '6 months')
      ORDER BY period DESC`,
      [companyId, period]
    );

    // Gọi AI service
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-salary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        period,
        employees,
        history
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI salary prediction service không phản hồi', 503);
    }

    const result = await response.json();

    logger.info({
      companyId,
      period,
      predictedCost: result.total_predicted_cost
    }, 'AI salary cost predicted');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI salary prediction service', 503);
  }
}

/**
 * Phân tích KPI nhân viên
 * @param {string} companyId - ID công ty
 * @param {string} userId - ID nhân viên
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function analyzeEmployeeKPI(companyId, userId, period) {
  // Lấy dữ liệu hoạt động nhân viên
  const { rows: activity } = await pool.query(
    `SELECT 
      v.id as voucher_id,
      v.voucher_type,
      v.voucher_date,
      vd.amount
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.created_by = $1
    AND v.company_id = $2
    AND DATE_TRUNC('month', v.voucher_date) = DATE_TRUNC('month', $3::date)`,
    [userId, companyId, period]
  );

  // Lấy dữ liệu bán hàng (nếu có)
  const { rows: sales } = await pool.query(
    `SELECT 
      o.id,
      o.total_amount,
      o.created_at
    FROM orders o
    WHERE o.created_by = $1
    AND o.company_id = $2
    AND DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', $3::date)`,
    [userId, companyId, period]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/analyze-kpi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      company_id: companyId,
      period,
      activity,
      sales
    })
  });

  if (!response.ok) {
    return { kpi_score: 0, analysis: 'Không thể phân tích' };
  }

  return response.json();
}

/**
 * Dự báo nhu cầu tuyển dụng
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictRecruitmentNeeds(companyId, period) {
  // Lấy dữ liệu tăng trưởng
  const { rows: growth } = await pool.query(
    `SELECT 
      DATE_TRUNC('month', v.voucher_date) as month,
      COUNT(DISTINCT v.created_by) as active_users,
      COUNT(*) as transaction_count
    FROM vouchers v
    WHERE v.company_id = $1
    AND v.voucher_date >= (DATE_TRUNC('month', $2::date) - INTERVAL '12 months')
    GROUP BY DATE_TRUNC('month', v.voucher_date)
    ORDER BY month DESC`,
    [companyId, period]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-recruitment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: companyId,
      period,
      growth_data: growth
    })
  });

  if (!response.ok) {
    return { needs: [] };
  }

  return response.json();
}

export default {
  predictSalaryCost,
  analyzeEmployeeKPI,
  predictRecruitmentNeeds
};