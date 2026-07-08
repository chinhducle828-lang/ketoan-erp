/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiCopilot.service - Financial Copilot
 * Text-to-SQL + RAG Engine cho hỏi đáp tài chính
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

// Python AI service endpoint từ config
const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

/**
 * Chuyển câu hỏi tự nhiên thành SQL
 * @param {string} question - Câu hỏi
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function textToSQL(question, companyId) {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/text-to-sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        question, 
        company_id: companyId,
        schema: 'vouchers, voucher_details, partners, items, chart_of_accounts'
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI Copilot service không phản hồi', 503);
    }

    const result = await response.json();
    
    logger.info({ 
      companyId, 
      question,
      sql: result.sql 
    }, 'Text-to-SQL generated');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI Copilot service', 503);
  }
}

/**
 * Thực thi SQL an toàn (chỉ SELECT)
 * @param {string} sql - Câu lệnh SQL
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function executeSafeQuery(sql, companyId) {
  // Kiểm tra chỉ cho phép SELECT
  const upperSQL = sql.trim().toUpperCase();
  if (!upperSQL.startsWith('SELECT')) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Chỉ cho phép truy vấn SELECT', 400);
  }

  // Thêm company_id filter nếu chưa có
  let safeSQL = sql;
  if (!sql.toLowerCase().includes('company_id') && 
      !sql.toLowerCase().includes('tenant_id')) {
    // Thêm điều kiện company_id
    safeSQL = sql.replace(
      /FROM\s+(\w+)/i, 
      `FROM $1 WHERE company_id = '${companyId}'`
    );
  }

  try {
    const { rows } = await pool.query(safeSQL);
    return rows;
  } catch (error) {
    logger.error({ 
      error: error.message, 
      sql: safeSQL 
    }, 'SQL execution error');
    throw new AppError(ErrorCodes.DB_ERROR, 'Lỗi thực thi truy vấn', 500);
  }
}

/**
 * RAG Engine - Trả lời dựa trên dữ liệu thực
 * @param {string} question - Câu hỏi
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function askFinancialCopilot(question, companyId) {
  // Bước 1: Tạo SQL từ câu hỏi
  const sqlResult = await textToSQL(question, companyId);
  
  // Bước 2: Thực thi SQL
  const data = await executeSafeQuery(sqlResult.sql, companyId);
  
  // Bước 3: Tóm tắt kết quả bằng AI
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/rag-summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      question, 
      data,
      sql: sqlResult.sql
    })
  });

  if (!response.ok) {
    // Trả về dữ liệu thô nếu AI summarize lỗi
    return {
      question,
      answer: `Tìm được ${data.length} bản ghi`,
      data,
      sql: sqlResult.sql
    };
  }

  const summary = await response.json();

  return {
    question,
    answer: summary.answer,
    data,
    sql: sqlResult.sql,
    confidence: summary.confidence || 80
  };
}

/**
 * Lưu câu hỏi thường gặp
 * @param {string} question - Câu hỏi
 * @param {string} companyId - ID công ty
 * @param {string} answer - Câu trả lời
 * @returns {Promise<void>}
 */
export async function saveQueryToKnowledgeBase(question, companyId, answer) {
  await pool.query(
    `INSERT INTO ai_copilot_kb (
      company_id, question, answer, created_at
    ) VALUES ($1, $2, $3, NOW())`,
    [companyId, question, answer]
  );
}

/**
 * Lấy câu hỏi gợi ý
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function getSuggestedQueries(companyId) {
  const { rows } = await pool.query(
    `SELECT question, answer 
     FROM ai_copilot_kb 
     WHERE company_id = $1 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [companyId]
  );

  return rows;
}

export default {
  textToSQL,
  executeSafeQuery,
  askFinancialCopilot,
  saveQueryToKnowledgeBase,
  getSuggestedQueries
};