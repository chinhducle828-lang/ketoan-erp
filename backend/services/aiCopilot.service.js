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
import { initializeGemini, isGeminiAvailable, generateSQL, analyzeData, solveMathProblem as solveMathWithGemini, analyzeWorkflow as analyzeWorkflowWithGemini } from './geminiClient.js';

// Python AI service endpoint từ config
const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

// Initialize Gemini on module load
let geminiInitialized = false;
try {
  geminiInitialized = initializeGemini();
} catch (error) {
  logger.warn('Gemini initialization failed on module load', error);
}

/**
 * Chuyển câu hỏi tự nhiên thành SQL
 * @param {string} question - Câu hỏi
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function textToSQL(question, companyId) {
  try {
    // Use Gemini if available, otherwise fallback to Python service
    if (geminiInitialized && isGeminiAvailable()) {
      const schema = `
        Tables:
        - vouchers (id, company_id, voucher_type, voucher_date, description, created_at)
        - voucher_details (id, voucher_id, account_code, entry_type, amount, description)
        - partners (id, company_id, partner_name, partner_type, tax_code, phone, email)
        - items (id, company_id, item_name, item_code, unit, unit_price)
        - chart_of_accounts (account_code, account_name, account_type, parent_code)
        
        Relationships:
        - vouchers.company_id → partners.company_id
        - voucher_details.voucher_id → vouchers.id
        - items.company_id → partners.company_id
      `;
      
      const result = await generateSQL(question, schema, companyId);
      
      logger.info({ 
        companyId, 
        question,
        sql: result.sql,
        model: result.model 
      }, 'Text-to-SQL generated with Gemini');

      return result;
    }

    // Fallback to Python service (only if configured)
    if (!PYTHON_AI_SERVICE_URL) {
      logger.warn('Neither Gemini nor Python AI service available');
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI service chưa được cấu hình', 503);
    }

    logger.warn('Gemini not available, falling back to Python service');
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
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'Python AI service error');
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI Copilot service không phản hồi', 503);
    }

    const result = await response.json();
    
    logger.info({ 
      companyId, 
      question,
      sql: result.sql 
    }, 'Text-to-SQL generated with Python service');

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      logger.error({ error: error.message, question, companyId }, 'textToSQL error');
      throw error;
    }
    logger.error({ error: error.message, question, companyId }, 'textToSQL unexpected error');
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

  // Kiểm tra từ khóa nguy hiểm
  const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE'];
  const hasDangerousKeyword = dangerousKeywords.some(keyword => 
    upperSQL.includes(keyword)
  );
  if (hasDangerousKeyword) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Truy vấn chứa từ khóa không được phép', 400);
  }

  try {
    // Sử dụng parameterized query để tránh SQL injection
    // Thay thế company_id = 'value' bằng company_id = $1
    let parameterizedSQL = sql;
    const params = [companyId];
    let paramIndex = 1;
    
    // Đếm số lần xuất hiện của company_id trong SQL
    const companyIdMatches = sql.match(/company_id\s*=\s*['"][^'"]*['"]/gi) || [];
    
    // Nếu đã có company_id filter, kiểm tra và thay thế bằng parameter
    if (companyIdMatches.length > 0) {
      // Thay thế tất cả company_id = 'xxx' bằng company_id = $N
      parameterizedSQL = sql.replace(
        /company_id\s*=\s*['"][^'"]*['"]/gi,
        () => `company_id = $${paramIndex++}`
      );
      // Thêm companyId vào params cho mỗi match
      for (let i = 0; i < companyIdMatches.length; i++) {
        params.push(companyId);
      }
    } else {
      // Thêm company_id filter bằng parameter
      // Tìm vị trí FROM đầu tiên
      const fromMatch = sql.match(/FROM\s+\w+/i);
      if (fromMatch) {
        const fromIndex = fromMatch.index;
        const beforeFrom = sql.substring(0, fromIndex + fromMatch[0].length);
        const afterFrom = sql.substring(fromIndex + fromMatch[0].length);
        
        // Kiểm tra xem đã có WHERE chưa
        if (afterFrom.trim().toUpperCase().startsWith('WHERE')) {
          parameterizedSQL = `${beforeFrom} AND company_id = $${paramIndex++}${afterFrom.substring(5)}`;
        } else {
          parameterizedSQL = `${beforeFrom} WHERE company_id = $${paramIndex++}${afterFrom}`;
        }
        params.push(companyId);
      }
    }

    // Log the parameterized query for audit
    logger.info({ 
      originalSQL: sql,
      parameterizedSQL,
      paramCount: params.length
    }, 'Executing parameterized SQL query');

    const { rows } = await pool.query(parameterizedSQL, params);
    return rows;
  } catch (error) {
    logger.error({ 
      error: error.message, 
      sql: sql 
    }, 'SQL execution error');
    throw new AppError(ErrorCodes.DB_ERROR, 'Lỗi thực thi truy vấn', 500);
  }
}

/**
 * RAG Engine - Trả lời dựa trên dữ liệu thực với Gemini AI
 * @param {string} question - Câu hỏi
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function askFinancialCopilot(question, companyId) {
  try {
    // Bước 1: Tạo SQL từ câu hỏi
    const sqlResult = await textToSQL(question, companyId);
    
    // Bước 2: Thực thi SQL
    const data = await executeSafeQuery(sqlResult.sql, companyId);
    
    // Bước 3: Phân tích kết quả bằng Gemini AI
    if (geminiInitialized && isGeminiAvailable()) {
      const analysis = await analyzeData(question, data, sqlResult.sql);
      
      return {
        question,
        answer: analysis.answer,
        data,
        sql: sqlResult.sql,
        confidence: analysis.confidence,
        model: analysis.model,
        recordsAnalyzed: analysis.recordsAnalyzed
      };
    }

    // Fallback: Trả về dữ liệu thô nếu Gemini không khả dụng
    logger.warn('Gemini not available, returning raw data');
    return {
      question,
      answer: `Tìm được ${data.length} bản ghi`,
      data,
      sql: sqlResult.sql,
      confidence: 70
    };
  } catch (error) {
    logger.error({ error: error.message, question, companyId }, 'askFinancialCopilot error');
    throw error;
  }
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

/**
 * Giải bài toán đại số/tài chính
 * @param {string} problem - Bài toán
 * @param {string} context - Ngữ cảnh
 * @returns {Promise<Object>}
 */
export async function solveMathProblem(problem, context = 'financial') {
  if (!geminiInitialized || !isGeminiAvailable()) {
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI Math service không khả dụng', 503);
  }
  return solveMathWithGemini(problem, context);
}

/**
 * Phân tích workflow
 * @param {string} workflowType - Loại workflow
 * @param {Object} workflowData - Dữ liệu workflow
 * @returns {Promise<Object>}
 */
export async function analyzeWorkflow(workflowType, workflowData) {
  if (!geminiInitialized || !isGeminiAvailable()) {
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI Workflow service không khả dụng', 503);
  }
  return analyzeWorkflowWithGemini(workflowType, workflowData);
}

export default {
  textToSQL,
  executeSafeQuery,
  askFinancialCopilot,
  saveQueryToKnowledgeBase,
  getSuggestedQueries,
  solveMathProblem,
  analyzeWorkflow
};
