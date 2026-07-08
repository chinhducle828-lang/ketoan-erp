/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiModelVersion.service - Quản lý version model AI
 * Theo dõi độ chính xác và quản lý việc triển khai model mới
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Lấy danh sách version model
 * @param {string} modelName - Tên model
 * @returns {Promise<Array>}
 */
export async function getModelVersions(modelName = null) {
  let query = 'SELECT * FROM ai_model_versions';
  const params = [];

  if (modelName) {
    query += ' WHERE model_name = $1';
    params.push(modelName);
  }

  query += ' ORDER BY deployed_at DESC';

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Lấy version đang active
 * @param {string} modelName - Tên model
 * @returns {Promise<Object>}
 */
export async function getActiveModel(modelName) {
  const { rows } = await pool.query(
    `SELECT * FROM ai_model_versions 
     WHERE model_name = $1 AND is_active = TRUE 
     ORDER BY deployed_at DESC 
     LIMIT 1`,
    [modelName]
  );

  return rows[0] || null;
}

/**
 * Triển khai model mới
 * @param {string} modelName - Tên model
 * @param {string} version - Version mới
 * @param {number} accuracyScore - Độ chính xác
 * @param {number} trainingDataCount - Số lượng dữ liệu training
 * @returns {Promise<Object>}
 */
export async function deployNewModel(modelName, version, accuracyScore = 0, trainingDataCount = 0) {
  const client = await pool.getClient();
  try {
    await client.query('BEGIN');

    // Vô hiệu hóa model cũ
    await client.query(
      `UPDATE ai_model_versions 
       SET is_active = FALSE 
       WHERE model_name = $1 AND is_active = TRUE`,
      [modelName]
    );

    // Thêm model mới
    const { rows } = await client.query(
      `INSERT INTO ai_model_versions (
        model_name, version, accuracy_score, training_data_count, is_active
      ) VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *`,
      [modelName, version, accuracyScore, trainingDataCount]
    );

    await client.query('COMMIT');

    logger.info({
      modelName,
      version,
      accuracyScore,
      trainingDataCount
    }, 'New AI model deployed');

    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw new AppError(ErrorCodes.DB_ERROR, 'Lỗi triển khai model mới', 500);
  } finally {
    client.release();
  }
}

/**
 * Cập nhật độ chính xác model
 * @param {number} modelId - ID model
 * @param {number} accuracyScore - Độ chính xác mới
 * @returns {Promise<Object>}
 */
export async function updateModelAccuracy(modelId, accuracyScore) {
  const { rows } = await pool.query(
    `UPDATE ai_model_versions 
     SET accuracy_score = $1 
     WHERE id = $2 
     RETURNING *`,
    [accuracyScore, modelId]
  );

  return rows[0];
}

/**
 * Lấy thống kê so sánh các version
 * @param {string} modelName - Tên model
 * @returns {Promise<Object>}
 */
export async function getModelComparisonStats(modelName) {
  const { rows } = await pool.query(
    `SELECT 
      version,
      accuracy_score,
      training_data_count,
      deployed_at,
      is_active
    FROM ai_model_versions 
    WHERE model_name = $1 
    ORDER BY deployed_at DESC 
    LIMIT 5`,
    [modelName]
  );

  return rows;
}

/**
 * Tính toán độ cải thiện dựa trên feedback
 * @param {string} modelName - Tên model
 * @returns {Promise<Object>}
 */
export async function calculateModelImprovement(modelName) {
  // Tính accuracy từ HITL logs trong 30 ngày
  const { rows } = await pool.query(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_modified = FALSE AND processing_status = 'approved' THEN 1 END) as correct,
      AVG(ai_confidence_score) as avg_confidence
    FROM ai_hitl_logs 
    WHERE created_at >= NOW() - INTERVAL '30 days'`,
  );

  const stats = rows[0];
  const accuracy = stats.total > 0 
    ? (Number(stats.correct) / Number(stats.total) * 100).toFixed(2)
    : 0;

  return {
    totalProposals: Number(stats.total),
    correctProposals: Number(stats.correct),
    accuracy: Number(accuracy),
    avgConfidence: Number(stats.avg_confidence) || 0
  };
}

/**
 * Kiểm tra xem có nên tự động triển khai model mới không
 * Dựa trên ngưỡng cải thiện độ chính xác
 * @param {string} modelName - Tên model
 * @param {number} threshold - Ngưỡng cải thiện (%)
 * @returns {Promise<boolean>}
 */
export async function shouldDeployNewModel(modelName, threshold = 5) {
  const { rows } = await pool.query(
    `SELECT 
      accuracy_score,
      deployed_at
    FROM ai_model_versions 
    WHERE model_name = $1 
    ORDER BY deployed_at DESC 
    LIMIT 2`,
    [modelName]
  );

  if (rows.length < 2) return false;

  const currentAccuracy = Number(rows[0].accuracy_score) || 0;
  const previousAccuracy = Number(rows[1].accuracy_score) || 0;

  const improvement = currentAccuracy - previousAccuracy;
  
  return improvement >= threshold;
}

export default {
  getModelVersions,
  getActiveModel,
  deployNewModel,
  updateModelAccuracy,
  getModelComparisonStats,
  calculateModelImprovement,
  shouldDeployNewModel
};