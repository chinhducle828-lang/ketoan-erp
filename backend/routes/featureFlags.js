/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Default feature flags
const DEFAULT_FEATURE_FLAGS = {
  'basic-accounting': true,
  'voucher-management': true,
  'partner-management': true,
  'inventory-management': true,
  'stock-reconciliation': true,
  'debt-reconciliation': true,
  'reversing-entries': true,
  'non-deductible-expenses': true,
  'ai-copilot': true,
  'advanced-reports': true,
  'multi-currency': false,
  'advanced-analytics': false,
  'einvoice': true,
  'push-notifications': true,
  'sms-notifications': false,
  'webhook-integrations': false
};

// GET /api/feature-flags - Get all feature flags (admin only)
router.get('/', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT flag_name, is_enabled, description, updated_at FROM feature_flags ORDER BY flag_name');
    const dbFlags = result.rows;
    
    // Merge with defaults
    const flags = { ...DEFAULT_FEATURE_FLAGS };
    dbFlags.forEach(row => {
      flags[row.flag_name] = row.is_enabled;
    });
    
    res.json({ flags, source: 'database' });
  } catch (err) {
    console.error('Error fetching feature flags:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/feature-flags - Update feature flags (admin only)
router.put('/', authenticate, requireRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { flags } = req.body;
    if (!flags || typeof flags !== 'object') {
      return res.status(400).json({ error: 'Invalid flags object' });
    }
    
    // Upsert each flag
    for (const [flagName, isEnabled] of Object.entries(flags)) {
      await client.query(
        `INSERT INTO feature_flags (flag_name, is_enabled, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (flag_name) 
         DO UPDATE SET is_enabled = $2, updated_at = CURRENT_TIMESTAMP`,
        [flagName, Boolean(isEnabled)]
      );
    }
    
    await client.query('COMMIT');
    
    // Return merged flags
    const result = await pool.query('SELECT flag_name, is_enabled FROM feature_flags');
    const mergedFlags = { ...DEFAULT_FEATURE_FLAGS };
    result.rows.forEach(row => {
      mergedFlags[row.flag_name] = row.is_enabled;
    });
    
    res.json({ flags: mergedFlags, message: 'Feature flags updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating feature flags:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/feature-flags/:flagName - Check specific flag
router.get('/:flagName', authenticate, async (req, res) => {
  try {
    const { flagName } = req.params;
    const result = await pool.query('SELECT is_enabled FROM feature_flags WHERE flag_name = $1', [flagName]);
    
    if (result.rows.length === 0) {
      // Return default if not in database
      const isEnabled = DEFAULT_FEATURE_FLAGS[flagName] ?? false;
      return res.json({ flagName, isEnabled, source: 'default' });
    }
    
    res.json({ flagName, isEnabled: result.rows[0].is_enabled, source: 'database' });
  } catch (err) {
    console.error('Error fetching feature flag:', err);
    res.status(500).json({ error: err.message });
  }
});

export { router as featureFlagsRouter };