/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiDepartmentClassifier.service - Department Classification
 * Data-driven department classification using AI + database rules
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { callAI } from './aiAdapter.service.js';
import { AI_CONFIG } from '../config/aiConfig.js';

import { getConfigNumber, getConfigString, getConfig } from '../utils/configHelper.js';


/**
 * Classify department based on content
 * @param {Object} content - Content to classify (invoice, voucher, etc.)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Classification result
 */
export async function classifyDepartment(content, companyId) {
  try {
    // 1. Load departments from DATABASE (not hardcoded!)
    const departmentsResult = await pool.query(
      'SELECT * FROM ai_departments WHERE is_active = true ORDER BY department_name'
    );

    if (departmentsResult.rows.length === 0) {
      logger.warn('No departments found in database, using default');
      return getDefaultClassification();
    }

    const departments = departmentsResult.rows;

    // 2. Build prompt dynamically from database
    const prompt = `You are a department classification AI for a Vietnamese accounting ERP system.

Available Departments (from database):
${departments.map(d => `
${d.department_code}: ${d.department_name}
  - Keywords: ${d.keywords.join(', ')}
  - Account Codes: ${d.account_codes.join(', ')}
  - Description: ${d.description}
`).join('\n')}

Content to Classify:
${JSON.stringify(content, null, 2)}

Instructions:
1. Analyze the content (text, items, accounts, amounts, descriptions)
2. Match against department keywords and account codes from database
3. Determine the most appropriate department
4. Provide confidence score (0-100)
5. Explain your reasoning
6. List matched keywords and accounts

Return JSON format:
{
  "department": "department_code",
  "department_name": "Vietnamese name",
  "confidence": 0-100,
  "reasoning": "explanation",
  "matched_keywords": ["keyword1", "keyword2"],
  "matched_accounts": ["156", "331"]
}`;

    // 3. Call Gemini AI
    const response = await callAI({
      prompt,
      provider: 'gemini',
      temperature: AI_CONFIG.GEMINI.TEMPERATURE,
      maxTokens: AI_CONFIG.GEMINI.MAX_TOKENS,
      context: { timeout: 15000 },
    });

    // 4. Parse JSON from response content
    try {
      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const classification = JSON.parse(jsonMatch ? jsonMatch[0] : text);

      // 5. Validate classification exists in database
      const validDepartment = departments.find(d => d.department_code === classification.department);
      
      if (!validDepartment) {
        logger.warn({ classification }, 'AI returned invalid department, using fallback');
        return getFallbackClassification(content, departments);
      }

      // 6. Log classification for learning
      await logClassification(companyId, content, classification);

      logger.info({
        companyId,
        department: classification.department,
        confidence: classification.confidence
      }, 'Department classified');

      return {
        success: true,
        classification: {
          department_code: classification.department,
          department_name: classification.department_name,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          matched_keywords: classification.matched_keywords || [],
          matched_accounts: classification.matched_accounts || []
        },
        model: AI_CONFIG.GEMINI.MODEL
      };

    } catch (parseError) {
      logger.error({ error: parseError.message, response }, 'Failed to parse classification JSON');
      return getFallbackClassification(content, departments);
    }

  } catch (error) {
    logger.error({ error: error.message, content }, 'Department classification failed');
    return {
      success: false,
      classification: {
        department_code: 'finance',
        department_name: 'Phòng Tài chính - Kế toán',
        confidence: 0,
        error: error.message
      }
    };
  }
}

/**
 * Get fallback classification using database rules
 */
async function getFallbackClassification(content, departments) {
  try {
    const contentStr = JSON.stringify(content).toLowerCase();

    // Match against department keywords and accounts from database
    for (const dept of departments) {
      const keywords = dept.keywords || [];
      const accountCodes = dept.account_codes || [];

      // Check keywords
      const matchedKeywords = keywords.filter(kw => contentStr.includes(kw.toLowerCase()));
      
      // Check account codes
      const matchedAccounts = accountCodes.filter(acc => contentStr.includes(acc));

      if (matchedKeywords.length > 0 || matchedAccounts.length > 0) {
        const confidence = Math.min(100, 70 + (matchedKeywords.length * 5) + (matchedAccounts.length * 10));
        
        return {
          success: true,
          classification: {
            department_code: dept.department_code,
            department_name: dept.department_name,
            confidence: Math.min(confidence, 85),
            reasoning: `Matched ${matchedKeywords.length} keywords and ${matchedAccounts.length} account codes`,
            matched_keywords: matchedKeywords,
            matched_accounts: matchedAccounts
          },
          model: 'fallback'
        };
      }
    }

    // Default to finance if no match
    const financeDept = departments.find(d => d.department_code === 'finance') || departments[0];
    return {
      success: true,
      classification: {
        department_code: financeDept?.department_code || 'finance',
        department_name: financeDept?.department_name || 'Phòng Tài chính - Kế toán',
        confidence: 50,
        reasoning: 'No specific department matched, using default',
        matched_keywords: [],
        matched_accounts: []
      },
      model: 'fallback'
    };

  } catch (error) {
    logger.error({ error: error.message }, 'Fallback classification failed');
    return getDefaultClassification();
  }
}

/**
 * Get default classification
 */
function getDefaultClassification() {
  return {
    success: true,
    classification: {
      department_code: 'finance',
      department_name: 'Phòng Tài chính - Kế toán',
      confidence: 50,
      reasoning: 'Default department',
      matched_keywords: [],
      matched_accounts: []
    },
    model: 'default'
  };
}

/**
 * Log classification for learning
 */
async function logClassification(companyId, content, classification) {
  try {
    await pool.query(
      `INSERT INTO ai_learning_data (
        company_id, module, input_data, ai_output, is_correct
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        companyId,
        'classifier',
        JSON.stringify(content),
        JSON.stringify(classification),
        null  // Will be updated when user confirms
      ]
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to log classification');
  }
}

/**
 * Get all departments (for admin UI)
 */
export async function getAllDepartments() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_departments ORDER BY department_name'
    );
    return rows;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get departments');
    throw error;
  }
}

/**
 * Get department by ID
 */
export async function getDepartmentById(id) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_departments WHERE id = $1',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to get department');
    throw error;
  }
}

/**
 * Create department
 */
export async function createDepartment(data) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO ai_departments (
        department_code, department_name, keywords, account_codes, description
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.department_code,
        data.department_name,
        JSON.stringify(data.keywords || []),
        JSON.stringify(data.account_codes || []),
        data.description
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, data }, 'Failed to create department');
    throw error;
  }
}

/**
 * Update department
 */
export async function updateDepartment(id, data) {
  try {
    const { rows } = await pool.query(
      `UPDATE ai_departments
      SET department_code = $2,
          department_name = $3,
          keywords = $4,
          account_codes = $5,
          description = $6
      WHERE id = $1
      RETURNING *`,
      [
        id,
        data.department_code,
        data.department_name,
        JSON.stringify(data.keywords || []),
        JSON.stringify(data.account_codes || []),
        data.description
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id, data }, 'Failed to update department');
    throw error;
  }
}

/**
 * Delete department (soft delete)
 */
export async function deleteDepartment(id) {
  try {
    const { rows } = await pool.query(
      'UPDATE ai_departments SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to delete department');
    throw error;
  }
}

export default {
  classifyDepartment,
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};