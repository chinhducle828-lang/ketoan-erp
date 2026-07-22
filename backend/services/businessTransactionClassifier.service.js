/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * businessTransactionClassifier.service - 3-Layer Transaction Classification
 * Layer 1: Dynamic Keyword Rule Engine (database-driven)
 * Layer 2: AI Department Classifier integration
 * Layer 3: AI OCR + LLM (Gemini) for complex transactions
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { callAI } from './aiAdapter.service.js';
import { AI_CONFIG } from '../config/aiConfig.js';
import { classifyDepartment } from './aiDepartmentClassifier.service.js';
import { getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';

/**
 * Layer 1: Dynamic Keyword Rule Engine
 * Loads rules from database and matches against content
 */
async function classifyByRules(content, companyId) {
  try {
    // Load active rules from database (company-specific + system defaults)
    const rulesResult = await pool.query(
      `SELECT * FROM transaction_classification_rules 
       WHERE is_active = true 
       AND (company_id = $1 OR company_id = 0)
       ORDER BY priority ASC`,
      [companyId]
    );

    const rules = rulesResult.rows;
    
    if (rules.length === 0) {
      logger.debug({ companyId }, 'No classification rules found');
      return null;
    }

    const contentStr = JSON.stringify(content).toLowerCase();
    
    // Check each rule in priority order
    for (const rule of rules) {
      const conditions = rule.conditions;
      let matchScore = 0;
      
      // Check keywords
      if (conditions.keywords && Array.isArray(conditions.keywords)) {
        const matchedKeywords = conditions.keywords.filter(kw => 
          contentStr.includes(kw.toLowerCase())
        );
        if (matchedKeywords.length > 0) {
          matchScore += matchedKeywords.length * 10;
        }
      }
      
      // Check patterns (regex)
      if (conditions.patterns && Array.isArray(conditions.patterns)) {
        const matchedPatterns = conditions.patterns.filter(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(contentStr);
          } catch (e) {
            return false;
          }
        });
        if (matchedPatterns.length > 0) {
          matchScore += matchedPatterns.length * 15;
        }
      }
      
      // Check account codes
      if (conditions.account_codes && Array.isArray(conditions.account_codes)) {
        const matchedAccounts = conditions.account_codes.filter(acc => 
          contentStr.includes(acc)
        );
        if (matchedAccounts.length > 0) {
          matchScore += matchedAccounts.length * 20;
        }
      }
      
      // Check amount range
      if (content.amount && conditions.min_amount !== undefined && conditions.max_amount !== undefined) {
        if (content.amount >= conditions.min_amount && content.amount <= conditions.max_amount) {
          matchScore += 25;
        }
      }
      
      // Check partner type
      if (conditions.partner_types && Array.isArray(conditions.partner_types) && content.partner_type) {
        if (conditions.partner_types.includes(content.partner_type)) {
          matchScore += 30;
        }
      }
      
      // If match score > 0, return this rule's action
      if (matchScore > 0) {
        const confidence = Math.min(100, 50 + matchScore);
        
        logger.info({
          companyId,
          rule: rule.rule_name,
          matchScore,
          confidence
        }, 'Rule-based classification matched');
        
        return {
          success: true,
          classification: {
            ...rule.action_value,
            confidence,
            rule_id: rule.id,
            rule_name: rule.rule_name,
            source: 'rule'
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Rule-based classification failed');
    return null;
  }
}

/**
 * Layer 2: AI Department Classifier
 * Uses existing aiDepartmentClassifier service
 */
async function classifyByDepartmentAI(content, companyId) {
  try {
    const result = await classifyDepartment(content, companyId);
    
    if (result.success && result.classification) {
      // Get account codes for this department from database
      const deptResult = await pool.query(
        'SELECT account_codes FROM ai_departments WHERE department_code = $1 AND is_active = true',
        [result.classification.department_code]
      );
      
      const accountCodes = deptResult.rows[0]?.account_codes || [];
      
      return {
        success: true,
        classification: {
          department_code: result.classification.department_code,
          department_name: result.classification.department_name,
          account_code: accountCodes[0] || null, // Primary account for department
          entry_type: determineEntryType(accountCodes[0]),
          confidence: result.classification.confidence,
          reasoning: result.classification.reasoning,
          matched_keywords: result.classification.matched_keywords,
          source: 'ai_department'
        }
      };
    }
    
    return null;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Department AI classification failed');
    return null;
  }
}

/**
 * Layer 3: AI OCR + LLM (Gemini) for complex transactions
 */
async function classifyByGemini(content, companyId) {
  try {
    // Load chart of accounts from database for context
    const accountsResult = await pool.query(
      `SELECT account_code, account_name FROM chart_of_accounts 
       WHERE is_active = true 
       ORDER BY account_code`
    );
    
    const accounts = accountsResult.rows;
    
    // Load departments for context
    const deptsResult = await pool.query(
      'SELECT department_code, department_name, keywords, account_codes FROM ai_departments WHERE is_active = true'
    );
    
    const departments = deptsResult.rows;
    
    const prompt = `You are an expert Vietnamese accounting classifier. Analyze the transaction and suggest the appropriate accounting entry.

Available Chart of Accounts (from database):
${accounts.map(a => `${a.account_code}: ${a.account_name || ''}`).join('\n')}

Available Departments (from database):
${departments.map(d => `${d.department_code}: ${d.department_name} (keywords: ${d.keywords?.join(', ') || ''})`).join('\n')}

Transaction to Classify:
${JSON.stringify(content, null, 2)}

Instructions:
1. Determine the most appropriate account_code based on Vietnamese accounting standards (Thông tư 99/2025/TT-BTC)
2. Determine the entry_type (DR for debit, CR for credit)
3. Suggest a department_code if applicable
4. Provide confidence score (0-100)
5. Explain your reasoning

Return JSON format:
{
  "account_code": "511",
  "entry_type": "CR",
  "department_code": "sales",
  "confidence": 90,
  "reasoning": "Explanation of why this account was chosen"
}`;

    const response = await callAI({
      prompt,
      provider: 'gemini',
      temperature: AI_CONFIG.GEMINI.TEMPERATURE,
      maxTokens: AI_CONFIG.GEMINI.MAX_TOKENS,
      context: { timeout: 15000 },
    });
    
    try {
      const text = response.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const classification = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      // Validate account exists
      const validAccount = accounts.find(a => a.account_code === classification.account_code);
      if (!validAccount) {
        logger.warn({ account: classification.account_code }, 'Gemini returned invalid account code');
        return null;
      }
      
      return {
        success: true,
        classification: {
          account_code: classification.account_code,
          entry_type: classification.entry_type || determineEntryType(classification.account_code),
          department_code: classification.department_code,
          confidence: classification.confidence || 75,
          reasoning: classification.reasoning,
          source: 'ai_ocr'
        }
      };
    } catch (parseError) {
      logger.error({ error: parseError.message }, 'Failed to parse Gemini classification');
      return null;
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Gemini classification failed');
    return null;
  }
}

/**
 * Determine entry type based on account nature
 */
function determineEntryType(accountCode) {
  if (!accountCode) return 'DR';
  
  const nature = getAccountNature(accountCode);
  
  // For hermaphroditic accounts (BOTH), we need more context
  // Default to DR for now, but this should be refined based on transaction type
  if (nature === ACCOUNT_NATURES.BOTH) {
    return 'DR'; // Will be determined by context
  }
  
  return nature === ACCOUNT_NATURES.DEBIT ? 'DR' : 'CR';
}

/**
 * Main classification function - 3 layer cascade
 */
export async function classifyTransaction(content, companyId) {
  const startTime = Date.now();
  
  try {
    // Layer 1: Try rule-based classification first (fastest, most accurate for known patterns)
    const ruleResult = await classifyByRules(content, companyId);
    if (ruleResult && ruleResult.classification.confidence >= 80) {
      await logClassification(companyId, content, ruleResult.classification, 'rule');
      return {
        ...ruleResult,
        processing_time_ms: Date.now() - startTime,
        layer_used: 1
      };
    }
    
    // Layer 2: Try AI Department Classifier
    const deptResult = await classifyByDepartmentAI(content, companyId);
    if (deptResult && deptResult.classification.confidence >= 70) {
      await logClassification(companyId, content, deptResult.classification, 'ai_department');
      return {
        ...deptResult,
        processing_time_ms: Date.now() - startTime,
        layer_used: 2
      };
    }
    
    // Layer 3: Try Gemini for complex transactions
    const geminiResult = await classifyByGemini(content, companyId);
    if (geminiResult) {
      await logClassification(companyId, content, geminiResult.classification, 'ai_ocr');
      return {
        ...geminiResult,
        processing_time_ms: Date.now() - startTime,
        layer_used: 3
      };
    }
    
    // Fallback: Return rule result if any, or default
    if (ruleResult) {
      return {
        ...ruleResult,
        processing_time_ms: Date.now() - startTime,
        layer_used: 1
      };
    }
    
    // Default fallback
    const defaultResult = {
      success: true,
      classification: {
        account_code: '511', // Default to revenue
        entry_type: 'CR',
        department_code: 'finance',
        confidence: 30,
        reasoning: 'No classification matched, using default',
        source: 'default'
      },
      processing_time_ms: Date.now() - startTime,
      layer_used: 0
    };
    
    await logClassification(companyId, content, defaultResult.classification, 'default');
    return defaultResult;
    
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Transaction classification failed');
    return {
      success: false,
      classification: {
        account_code: null,
        entry_type: 'DR',
        department_code: null,
        confidence: 0,
        error: error.message,
        source: 'error'
      },
      processing_time_ms: Date.now() - startTime,
      layer_used: 0
    };
  }
}

/**
 * Log classification for learning and analytics
 */
async function logClassification(companyId, content, classification, source) {
  try {
    await pool.query(
      `INSERT INTO transaction_classifications (
        company_id, description, amount, account_code, partner_id,
        suggested_account_code, suggested_department_code, suggested_entry_type,
        confidence, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        companyId,
        content.description || content.voucher_description || '',
        content.amount || 0,
        content.account_code || null,
        content.partner_id || null,
        classification.account_code,
        classification.department_code,
        classification.entry_type,
        classification.confidence,
        source
      ]
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to log classification');
  }
}

/**
 * Get all rules for a company (for admin UI)
 */
export async function getRules(companyId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM transaction_classification_rules 
       WHERE company_id = $1 OR company_id = 0
       ORDER BY priority ASC, rule_name ASC`,
      [companyId]
    );
    return rows;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Failed to get rules');
    throw error;
  }
}

/**
 * Create a new rule
 */
export async function createRule(companyId, data) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO transaction_classification_rules (
        company_id, rule_name, rule_type, priority, is_active,
        conditions, action_type, action_value, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        companyId,
        data.rule_name,
        data.rule_type,
        data.priority || 100,
        data.is_active !== false,
        JSON.stringify(data.conditions),
        data.action_type,
        JSON.stringify(data.action_value),
        data.created_by || null
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, data }, 'Failed to create rule');
    throw error;
  }
}

/**
 * Update a rule
 */
export async function updateRule(id, companyId, data) {
  try {
    const { rows } = await pool.query(
      `UPDATE transaction_classification_rules
       SET rule_name = $3,
           rule_type = $4,
           priority = $5,
           is_active = $6,
           conditions = $7,
           action_type = $8,
           action_value = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (company_id = $2 OR company_id = 0)
       RETURNING *`,
      [
        id,
        companyId,
        data.rule_name,
        data.rule_type,
        data.priority || 100,
        data.is_active !== false,
        JSON.stringify(data.conditions),
        data.action_type,
        JSON.stringify(data.action_value)
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id, data }, 'Failed to update rule');
    throw error;
  }
}

/**
 * Delete a rule (soft delete)
 */
export async function deleteRule(id, companyId) {
  try {
    const { rows } = await pool.query(
      `UPDATE transaction_classification_rules
       SET is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (company_id = $2 OR company_id = 0)
       RETURNING *`,
      [id, companyId]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to delete rule');
    throw error;
  }
}

/**
 * Get classification history for learning
 */
export async function getClassificationHistory(companyId, options = {}) {
  try {
    const { limit = 100, offset = 0, source = null, is_accepted = null } = options;
    
    let query = `
      SELECT * FROM transaction_classifications 
      WHERE company_id = $1
    `;
    const params = [companyId];
    let paramIndex = 2;
    
    if (source) {
      query += ` AND source = $${paramIndex++}`;
      params.push(source);
    }
    
    if (is_accepted !== null) {
      query += ` AND is_accepted = $${paramIndex++}`;
      params.push(is_accepted);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Failed to get classification history');
    throw error;
  }
}

/**
 * Record user feedback on classification
 */
export async function recordFeedback(classificationId, isAccepted, userId) {
  try {
    const { rows } = await pool.query(
      `UPDATE transaction_classifications
       SET is_accepted = $2,
           accepted_by = $3,
           accepted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [classificationId, isAccepted, userId]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, classificationId }, 'Failed to record feedback');
    throw error;
  }
}

export default {
  classifyTransaction,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getClassificationHistory,
  recordFeedback
};