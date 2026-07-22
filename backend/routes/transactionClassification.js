/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * transactionClassification.js - API Routes for Transaction Classification
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { classifyTransaction, getRules, createRule, updateRule, deleteRule, getClassificationHistory, recordFeedback } from '../services/businessTransactionClassifier.service.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';

const router = express.Router();

/**
 * Classify a transaction
 * POST /api/transaction-classification/classify
 */
router.post('/classify', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    const companyId = req.user.company_id;
    
    if (!content) {
      throw new AppError('Content is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const result = await classifyTransaction(content, companyId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all rules for the company
 * GET /api/transaction-classification/rules
 */
router.get('/rules', authenticate, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const rules = await getRules(companyId);
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new rule
 * POST /api/transaction-classification/rules
 */
router.post('/rules', authenticate, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const data = req.body;
    
    if (!data.rule_name || !data.rule_type || !data.action_type || !data.action_value) {
      throw new AppError('Missing required fields: rule_name, rule_type, action_type, action_value', ErrorCodes.VALIDATION_ERROR);
    }
    
    const rule = await createRule(companyId, {
      ...data,
      created_by: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a rule
 * PUT /api/transaction-classification/rules/:id
 */
router.put('/rules/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const data = req.body;
    
    const rule = await updateRule(id, companyId, data);
    
    if (!rule) {
      throw new AppError('Rule not found', ErrorCodes.NOT_FOUND);
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a rule
 * DELETE /api/transaction-classification/rules/:id
 */
router.delete('/rules/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const rule = await deleteRule(id, companyId);
    
    if (!rule) {
      throw new AppError('Rule not found', ErrorCodes.NOT_FOUND);
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get classification history
 * GET /api/transaction-classification/history
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const { limit, offset, source, is_accepted } = req.query;
    
    const history = await getClassificationHistory(companyId, {
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
      source: source || null,
      is_accepted: is_accepted !== null ? is_accepted === 'true' : null
    });
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Record user feedback on classification
 * POST /api/transaction-classification/feedback
 */
router.post('/feedback', authenticate, async (req, res, next) => {
  try {
    const { classification_id, is_accepted } = req.body;
    
    if (!classification_id || is_accepted === undefined) {
      throw new AppError('Missing required fields: classification_id, is_accepted', ErrorCodes.VALIDATION_ERROR);
    }
    
    const result = await recordFeedback(classification_id, is_accepted, req.user.id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;