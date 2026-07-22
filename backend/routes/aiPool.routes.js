import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import aiApiPool from '../services/aiApiPool.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/ai/health - AI API Pool Health Check
 * Public endpoint for monitoring systems
 */
router.get('/health', (req, res) => {
  try {
    const health = aiApiPool.getHealth();
    res.json({
      status: 'success',
      health,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get AI pool health');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * GET /api/ai/stats - AI API Pool Statistics
 * Public endpoint for monitoring systems
 */
router.get('/stats', (req, res) => {
  try {
    const stats = aiApiPool.getStats();
    res.json({
      status: 'success',
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get AI pool stats');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * POST /api/ai/test-gemini - Test Gemini API with current keys
 * Requires authentication and admin role
 */
router.post('/test-gemini', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt required',
      });
    }

    const result = await aiApiPool.callGemini(prompt);
    res.json({
      status: 'success',
      result,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to test Gemini');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * POST /api/ai/test-groq - Test Groq API with current keys
 * Requires authentication and admin role
 */
router.post('/test-groq', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt required',
      });
    }

    const result = await aiApiPool.callGroq(prompt);
    res.json({
      status: 'success',
      result,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to test Groq');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * POST /api/ai/parallel-test - Test parallel API calls
 * Requires authentication and admin role
 */
router.post('/parallel-test', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { requests = [] } = req.body;
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'requests array required with at least one request',
      });
    }

    const results = await aiApiPool.parallelCalls(requests);
    res.json({
      status: 'success',
      results,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed parallel test');
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;