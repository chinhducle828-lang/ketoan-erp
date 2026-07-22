/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiSmartSuggestions.service - Smart Suggestions
 * Data-driven suggestions from database rules
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { callAI } from './aiAdapter.service.js';
import { AI_CONFIG } from '../config/aiConfig.js';

import { getConfigNumber, getConfigString, getConfig } from '../utils/configHelper.js';


/**
 * Get smart suggestions based on content
 * @param {Object} content - Content to analyze
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Suggestions
 */
export async function getSuggestions(content, companyId) {
  try {
    // 1. Load suggestion rules from DATABASE (not hardcoded!)
    const rulesResult = await pool.query(
      'SELECT * FROM ai_suggestion_rules WHERE is_active = true ORDER BY priority DESC, usage_count DESC'
    );

    if (rulesResult.rows.length === 0) {
      return { suggestions: [] };
    }

    const rules = rulesResult.rows;
    const contentStr = JSON.stringify(content).toLowerCase();

    // 2. Match content against rules
    const matchedRules = [];

    for (const rule of rules) {
      const triggerKeywords = rule.trigger_keywords || [];
      const triggerAccounts = rule.trigger_accounts || [];

      // Check if content matches rule triggers
      const matchedKeywords = triggerKeywords.filter(kw => 
        contentStr.includes(kw.toLowerCase())
      );
      
      const matchedAccounts = triggerAccounts.filter(acc => 
        contentStr.includes(acc)
      );

      if (matchedKeywords.length > 0 || matchedAccounts.length > 0) {
        matchedRules.push({
          ...rule,
          match_score: (matchedKeywords.length * 10) + (matchedAccounts.length * 20)
        });
      }
    }

    // 3. Sort by match score and priority
    matchedRules.sort((a, b) => {
      const scoreA = a.match_score + a.priority;
      const scoreB = b.match_score + b.priority;
      return scoreB - scoreA;
    });

    // 4. Get top suggestions (max 5)
    const topSuggestions = matchedRules.slice(0, 5);

    // 5. Use AI to enhance suggestions if available
    let enhancedSuggestions = topSuggestions;
    
    if (topSuggestions.length > 0 && AI_CONFIG.GEMINI.API_KEY) {
      try {
        enhancedSuggestions = await enhanceSuggestionsWithAI(
          content, 
          topSuggestions, 
          companyId
        );
      } catch (error) {
        logger.warn('AI enhancement failed, using database rules only', error);
      }
    }

    // 6. Update usage stats
    for (const suggestion of enhancedSuggestions) {
      await pool.query(
        'UPDATE ai_suggestion_rules SET usage_count = usage_count + 1 WHERE id = $1',
        [suggestion.id]
      );
    }

    logger.info({
      companyId,
      suggestions_count: enhancedSuggestions.length
    }, 'Suggestions generated');

    return {
      suggestions: enhancedSuggestions.map(s => ({
        rule_code: s.rule_code,
        rule_name: s.rule_name,
        suggested_accounts: s.suggested_accounts,
        suggested_entries: s.suggested_entries,
        confidence: s.confidence || 90,
        match_score: s.match_score,
        priority: s.priority
      }))
    };

  } catch (error) {
    logger.error({ error: error.message, content }, 'Failed to get suggestions');
    return { suggestions: [] };
  }
}

/**
 * Enhance suggestions with AI
 */
async function enhanceSuggestionsWithAI(content, rules, companyId) {
  try {
    const prompt = `You are a smart suggestions AI for a Vietnamese accounting ERP system.

User Input:
${JSON.stringify(content, null, 2)}

Matched Rules from Database:
${rules.map(r => `
${r.rule_code}: ${r.rule_name}
  - Suggested Accounts: ${JSON.stringify(r.suggested_accounts)}
  - Suggested Entries: ${JSON.stringify(r.suggested_entries)}
  - Priority: ${r.priority}
`).join('\n')}

Instructions:
1. Review the matched rules
2. Enhance suggestions based on context
3. Adjust confidence scores (0-100)
4. Add reasoning for each suggestion
5. Rank by relevance

Return JSON:
{
  "suggestions": [
    {
      "rule_code": "...",
      "confidence": 0-100,
      "reasoning": "...",
      "adjustments": {}
    }
  ]
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
      const aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      // Merge AI enhancements with database rules
      const enhancedRules = rules.map(rule => {
        const aiEnhancement = aiResult.suggestions?.find(s => s.rule_code === rule.rule_code);
        
        if (aiEnhancement) {
          return {
            ...rule,
            confidence: aiEnhancement.confidence || rule.confidence,
            reasoning: aiEnhancement.reasoning
          };
        }
        
        return rule;
      });

      return enhancedRules;
    } catch (parseError) {
      logger.warn('Failed to parse AI enhancement, using original rules');
      return rules;
    }
  } catch (error) {
    logger.warn('AI enhancement failed', error);
    return rules;
  }
}

/**
 * Learn from user correction
 */
export async function learnFromCorrection(ruleId, userId, originalSuggestion, userCorrection, companyId) {
  try {
    // 1. Log learning data
    await pool.query(
      `INSERT INTO ai_learning_data (
        company_id, module, input_data, ai_output, user_correction, is_correct
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        companyId,
        'suggestions',
        JSON.stringify(originalSuggestion),
        JSON.stringify(originalSuggestion),
        JSON.stringify(userCorrection),
        false
      ]
    );

    // 2. Update rule success/failure stats
    const rule = await pool.query(
      'SELECT * FROM ai_suggestion_rules WHERE id = $1',
      [ruleId]
    );

    if (rule.rows.length > 0) {
      const currentRule = rule.rows[0];
      
      // Check if correction matches suggestion
      const isCorrect = JSON.stringify(originalSuggestion) === JSON.stringify(userCorrection);
      
      await pool.query(
        `UPDATE ai_suggestion_rules
         SET success_count = success_count + $2,
             updated_at = NOW()
         WHERE id = $1`,
        [ruleId, isCorrect ? 1 : 0]
      );

      // 3. If confidence is low, suggest creating new rule
      if (!isCorrect && currentRule.success_count < 5) {
        await suggestNewRule(originalSuggestion, userCorrection, companyId, userId);
      }
    }

    logger.info({
      ruleId,
      isCorrect,
      companyId
    }, 'Learned from user correction');

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to learn from correction');
  }
}

/**
 * Suggest creating new rule based on user correction
 */
async function suggestNewRule(original, correction, companyId, userId) {
  try {
    // Analyze difference between original and correction
    const prompt = `You are an AI analyzing user corrections to improve suggestion rules.

Original Suggestion:
${JSON.stringify(original, null, 2)}

User Correction:
${JSON.stringify(correction, null, 2)}

Instructions:
1. Analyze the difference
2. Suggest a new rule that would have predicted the correction
3. Extract keywords and patterns
4. Suggest priority based on frequency

Return JSON:
{
  "suggested_rule": {
    "rule_code": "auto_generated_...",
    "rule_name": "...",
    "trigger_keywords": ["keyword1"],
    "trigger_accounts": ["156"],
    "suggested_accounts": [...],
    "suggested_entries": [...],
    "priority": 0-100,
    "reasoning": "..."
  }
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
      const suggestion = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      // Save suggestion for admin review
      await pool.query(
        `INSERT INTO ai_learning_data (
          company_id, module, input_data, ai_output, user_correction, learned
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          companyId,
          'new_rule_suggestion',
          JSON.stringify(original),
          JSON.stringify(suggestion.suggested_rule),
          JSON.stringify(correction),
          false
        ]
      );

      logger.info('New rule suggestion created', suggestion);
      
    } catch (parseError) {
      logger.warn('Failed to parse new rule suggestion');
    }
  } catch (error) {
    logger.warn('Failed to suggest new rule', error);
  }
}

/**
 * Get all suggestion rules (for admin UI)
 */
export async function getAllSuggestionRules() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_suggestion_rules ORDER BY priority DESC, usage_count DESC'
    );
    return rows;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get suggestion rules');
    throw error;
  }
}

/**
 * Get suggestion rule by ID
 */
export async function getSuggestionRuleById(id) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_suggestion_rules WHERE id = $1',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to get suggestion rule');
    throw error;
  }
}

/**
 * Create suggestion rule
 */
export async function createSuggestionRule(data) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO ai_suggestion_rules (
        rule_code, rule_name, trigger_keywords, trigger_accounts,
        suggested_accounts, suggested_entries, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.rule_code,
        data.rule_name,
        JSON.stringify(data.trigger_keywords || []),
        JSON.stringify(data.trigger_accounts || []),
        JSON.stringify(data.suggested_accounts || []),
        JSON.stringify(data.suggested_entries || []),
        data.priority || 0
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, data }, 'Failed to create suggestion rule');
    throw error;
  }
}

/**
 * Update suggestion rule
 */
export async function updateSuggestionRule(id, data) {
  try {
    const { rows } = await pool.query(
      `UPDATE ai_suggestion_rules
      SET rule_code = $2,
          rule_name = $3,
          trigger_keywords = $4,
          trigger_accounts = $5,
          suggested_accounts = $6,
          suggested_entries = $7,
          priority = $8
      WHERE id = $1
      RETURNING *`,
      [
        id,
        data.rule_code,
        data.rule_name,
        JSON.stringify(data.trigger_keywords || []),
        JSON.stringify(data.trigger_accounts || []),
        JSON.stringify(data.suggested_accounts || []),
        JSON.stringify(data.suggested_entries || []),
        data.priority || 0
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id, data }, 'Failed to update suggestion rule');
    throw error;
  }
}

/**
 * Delete suggestion rule (soft delete)
 */
export async function deleteSuggestionRule(id) {
  try {
    const { rows } = await pool.query(
      'UPDATE ai_suggestion_rules SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to delete suggestion rule');
    throw error;
  }
}

/**
 * Get suggestion statistics
 */
export async function getSuggestionStats() {
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total_rules,
        SUM(usage_count) as total_usage,
        SUM(success_count) as total_success,
        ROUND(AVG(CASE WHEN usage_count > 0 THEN (success_count::numeric / usage_count::numeric) * 100 ELSE 0 END), 2) as avg_success_rate
      FROM ai_suggestion_rules
      WHERE is_active = true`
    );

    const topRules = await pool.query(
      `SELECT 
        rule_code,
        rule_name,
        usage_count,
        success_count,
        ROUND((success_count::numeric / usage_count::numeric) * 100, 2) as success_rate
      FROM ai_suggestion_rules
      WHERE is_active = true AND usage_count > 0
      ORDER BY usage_count DESC
      LIMIT 10`
    );

    return {
      overview: stats.rows[0],
      top_rules: topRules.rows
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get suggestion stats');
    throw error;
  }
}

export default {
  getSuggestions,
  learnFromCorrection,
  getAllSuggestionRules,
  getSuggestionRuleById,
  createSuggestionRule,
  updateSuggestionRule,
  deleteSuggestionRule,
  getSuggestionStats
};