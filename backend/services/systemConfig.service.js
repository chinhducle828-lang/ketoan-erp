/**
 * System Config Service
 * ====================================================================
 * Service layer để quản lý system_configs với Redis cache
 * ====================================================================
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { redis, isRedisReadyCheck } from '../cache/redis.js';

dotenv.config();

const { Pool } = pkg;

// Database pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ketoan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_PREFIX = 'system_config';
const CACHE_TTL_SECONDS = 3600; // 1 hour

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate cache key for system config
 * @param {number|null} companyId - Company ID (null for global configs)
 * @param {string} configKey - Config key
 * @returns {string} Cache key
 */
function getCacheKey(companyId, configKey) {
  if (companyId) {
    return `${CACHE_PREFIX}:${companyId}:${configKey}`;
  }
  return `${CACHE_PREFIX}:global:${configKey}`;
}

/**
 * Invalidate cache for a specific config
 * @param {number|null} companyId - Company ID
 * @param {string} configKey - Config key
 */
async function invalidateCache(companyId, configKey) {
  if (!isRedisReadyCheck()) return;

  try {
    const key = getCacheKey(companyId, configKey);
    await redis.del(key);
  } catch (err) {
    console.error('Error invalidating cache:', err);
  }
}

/**
 * Invalidate all cache for a company
 * @param {number} companyId - Company ID
 */
async function invalidateCompanyCache(companyId) {
  if (!isRedisReadyCheck()) return;

  try {
    const pattern = `${CACHE_PREFIX}:${companyId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error('Error invalidating company cache:', err);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get system config value by key
 * @param {string} configKey - Config key (e.g., 'tax.standard_vat_rate')
 * @param {number|null} companyId - Company ID for company-specific configs
 * @returns {Promise<string|null>} Config value
 */
export async function getSystemConfig(configKey, companyId = null) {
  // Try cache first
  if (isRedisReadyCheck()) {
    try {
      const cacheKey = getCacheKey(companyId, configKey);
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch (err) {
      console.error('Cache read error:', err);
    }
  }

  // Query database
  try {
    let query, params;

    if (companyId) {
      // Try company-specific config first, then fallback to global
      query = `
        SELECT config_value FROM system_configs
        WHERE config_key = $1
          AND (
            (company_id = $2 AND is_active = true AND deleted_at IS NULL)
            OR
            (company_id IS NULL AND is_active = true AND deleted_at IS NULL)
          )
        ORDER BY company_id DESC NULLS LAST
        LIMIT 1
      `;
      params = [configKey, companyId];
    } else {
      // Only global configs
      query = `
        SELECT config_value FROM system_configs
        WHERE config_key = $1
          AND company_id IS NULL
          AND is_active = true
          AND deleted_at IS NULL
        LIMIT 1
      `;
      params = [configKey];
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      const value = result.rows[0].config_value;

      // Cache the result
      if (isRedisReadyCheck()) {
        try {
          const cacheKey = getCacheKey(companyId, configKey);
          await redis.setEx(cacheKey, CACHE_TTL_SECONDS, value);
        } catch (err) {
          console.error('Cache write error:', err);
        }
      }

      return value;
    }

    return null;
  } catch (err) {
    console.error('Error getting system config:', err);
    return null;
  }
}

/**
 * Get system config as number
 * @param {string} configKey - Config key
 * @param {number} defaultValue - Default value if not found
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Config value as number
 */
export async function getConfigNumber(configKey, defaultValue, companyId = null) {
  const value = await getSystemConfig(configKey, companyId);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Get system config as boolean
 * @param {string} configKey - Config key
 * @param {boolean} defaultValue - Default value if not found
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Config value as boolean
 */
export async function getConfigBoolean(configKey, defaultValue, companyId = null) {
  const value = await getSystemConfig(configKey, companyId);
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === true;
}

/**
 * Get system config as string
 * @param {string} configKey - Config key
 * @param {string} defaultValue - Default value if not found
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Config value as string
 */
export async function getConfigString(configKey, defaultValue, companyId = null) {
  const value = await getSystemConfig(configKey, companyId);
  return value || defaultValue;
}

/**
 * Get system config as JSON
 * @param {string} configKey - Config key
 * @param {Object} defaultValue - Default value if not found
 * @param {number|null} companyId - Company ID
 * @returns {Promise<Object>} Config value as JSON object
 */
export async function getConfigJSON(configKey, defaultValue, companyId = null) {
  const value = await getSystemConfig(configKey, companyId);
  if (!value) {
    return defaultValue;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error(`Error parsing JSON config ${configKey}:`, err);
    return defaultValue;
  }
}

/**
 * Get all system configs for a company
 * @param {number|null} companyId - Company ID (null for global only)
 * @returns {Promise<Array>} Array of config objects
 */
export async function getAllSystemConfigs(companyId = null) {
  try {
    let query, params;

    if (companyId) {
      // Get both company-specific and global configs
      query = `
        SELECT 
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          company_id,
          created_at,
          updated_at
        FROM system_configs
        WHERE 
          (company_id = $1 OR company_id IS NULL)
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY category, config_key
      `;
      params = [companyId];
    } else {
      // Only global configs
      query = `
        SELECT 
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          company_id,
          created_at,
          updated_at
        FROM system_configs
        WHERE 
          company_id IS NULL
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY category, config_key
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('Error getting all system configs:', err);
    return [];
  }
}

/**
 * Get system configs by category
 * @param {string} category - Category name
 * @param {number|null} companyId - Company ID
 * @returns {Promise<Array>} Array of config objects
 */
export async function getConfigsByCategory(category, companyId = null) {
  try {
    let query, params;

    if (companyId) {
      query = `
        SELECT 
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          company_id
        FROM system_configs
        WHERE 
          category = $1
          AND (company_id = $2 OR company_id IS NULL)
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY company_id DESC NULLS LAST, config_key
      `;
      params = [category, companyId];
    } else {
      query = `
        SELECT 
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          company_id
        FROM system_configs
        WHERE 
          category = $1
          AND company_id IS NULL
          AND is_active = true
          AND deleted_at IS NULL
        ORDER BY config_key
      `;
      params = [category];
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error('Error getting configs by category:', err);
    return [];
  }
}

/**
 * Create new system config
 * @param {Object} config - Config object
 * @param {string} config.config_key - Config key
 * @param {string} config.config_value - Config value
 * @param {string} config.value_type - Value type (string, number, boolean, json, array)
 * @param {string} config.category - Category
 * @param {string} config.description - Description
 * @param {boolean} config.is_sensitive - Is sensitive data
 * @param {boolean} config.is_editable - Is editable
 * @param {number|null} config.company_id - Company ID (null for global)
 * @param {number} userId - User ID who created
 * @returns {Promise<Object>} Created config
 */
export async function createSystemConfig(config, userId) {
  try {
    const {
      config_key,
      config_value,
      value_type = 'string',
      category,
      description,
      is_sensitive = false,
      is_editable = true,
      company_id = null
    } = config;

    const result = await pool.query(`
      INSERT INTO system_configs (
        config_key,
        config_value,
        value_type,
        category,
        description,
        is_sensitive,
        is_editable,
        company_id,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NOW(), NOW())
      RETURNING *
    `, [
      config_key,
      config_value,
      value_type,
      category,
      description,
      is_sensitive,
      is_editable,
      company_id,
      userId
    ]);

    const created = result.rows[0];

    // Invalidate cache
    await invalidateCache(company_id, config_key);

    // Log audit
    await logConfigAudit(config_key, 'CREATE', null, config_value, userId, company_id);

    return created;
  } catch (err) {
    console.error('Error creating system config:', err);
    throw err;
  }
}

/**
 * Update system config
 * @param {string} configKey - Config key
 * @param {Object} updates - Updates object
 * @param {string} updates.config_value - New config value
 * @param {boolean} updates.is_sensitive - Is sensitive data
 * @param {boolean} updates.is_editable - Is editable
 * @param {number|null} companyId - Company ID
 * @param {number} userId - User ID who updated
 * @returns {Promise<Object>} Updated config
 */
export async function updateSystemConfig(configKey, updates, companyId = null, userId) {
  try {
    const { config_value, is_sensitive, is_editable } = updates;

    // Build dynamic query
    const setClauses = [];
    const params = [];
    let paramCount = 1;

    if (config_value !== undefined) {
      setClauses.push(`config_value = $${paramCount++}`);
      params.push(config_value);
    }
    if (is_sensitive !== undefined) {
      setClauses.push(`is_sensitive = $${paramCount++}`);
      params.push(is_sensitive);
    }
    if (is_editable !== undefined) {
      setClauses.push(`is_editable = $${paramCount++}`);
      params.push(is_editable);
    }

    setClauses.push(`updated_by = $${paramCount++}`);
    params.push(userId);
    setClauses.push(`updated_at = NOW()`);

    // Add WHERE conditions
    params.push(configKey);
    if (companyId) {
      params.push(companyId);
    }

    let whereClause;
    if (companyId) {
      whereClause = `WHERE config_key = $${paramCount++} AND company_id = $${paramCount}`;
    } else {
      whereClause = `WHERE config_key = $${paramCount} AND company_id IS NULL`;
    }

    const query = `
      UPDATE system_configs
      SET ${setClauses.join(', ')}
      ${whereClause}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const updated = result.rows[0];

    // Invalidate cache
    await invalidateCache(companyId, configKey);

    // Log audit
    await logConfigAudit(configKey, 'UPDATE', null, config_value, userId, companyId);

    return updated;
  } catch (err) {
    console.error('Error updating system config:', err);
    throw err;
  }
}

/**
 * Delete system config (soft delete)
 * @param {string} configKey - Config key
 * @param {number|null} companyId - Company ID
 * @param {number} userId - User ID who deleted
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSystemConfig(configKey, companyId = null, userId) {
  try {
    let query, params;

    if (companyId) {
      query = `
        UPDATE system_configs
        SET deleted_at = NOW(),
            updated_by = $1,
            updated_at = NOW()
        WHERE config_key = $2
          AND company_id = $3
          AND deleted_at IS NULL
        RETURNING *
      `;
      params = [userId, configKey, companyId];
    } else {
      query = `
        UPDATE system_configs
        SET deleted_at = NOW(),
            updated_by = $1,
            updated_at = NOW()
        WHERE config_key = $2
          AND company_id IS NULL
          AND deleted_at IS NULL
        RETURNING *
      `;
      params = [userId, configKey];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return false;
    }

    const deleted = result.rows[0];

    // Invalidate cache
    await invalidateCache(companyId, configKey);

    // Log audit
    await logConfigAudit(configKey, 'DELETE', deleted.config_value, null, userId, companyId);

    return true;
  } catch (err) {
    console.error('Error deleting system config:', err);
    throw err;
  }
}

/**
 * Batch update system configs
 * @param {Array} configs - Array of { key, value }
 * @param {number|null} companyId - Company ID
 * @param {number} userId - User ID who updated
 * @returns {Promise<Object>} Result with success/failure counts
 */
export async function batchUpdateConfigs(configs, companyId = null, userId) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const config of configs) {
    try {
      await updateSystemConfig(config.key, { config_value: config.value }, companyId, userId);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        key: config.key,
        error: err.message
      });
    }
  }

  // Invalidate all cache for company
  if (companyId) {
    await invalidateCompanyCache(companyId);
  }

  return results;
}

/**
 * Export all system configs as JSON
 * @param {number|null} companyId - Company ID (null for global only)
 * @returns {Promise<Array>} Array of config objects
 */
export async function exportSystemConfigs(companyId = null) {
  try {
    const configs = await getAllSystemConfigs(companyId);

    // Remove sensitive fields if needed
    return configs.map(config => ({
      config_key: config.config_key,
      config_value: config.config_value,
      value_type: config.value_type,
      category: config.category,
      description: config.description,
      is_sensitive: config.is_sensitive,
      is_editable: config.is_editable
    }));
  } catch (err) {
    console.error('Error exporting system configs:', err);
    throw err;
  }
}

/**
 * Import system configs from JSON
 * @param {Array} configs - Array of config objects
 * @param {number|null} companyId - Company ID
 * @param {number} userId - User ID who imported
 * @returns {Promise<Object>} Result with success/failure counts
 */
export async function importSystemConfigs(configs, companyId = null, userId) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const config of configs) {
    try {
      const { config_key, config_value, value_type, category, description, is_sensitive, is_editable } = config;

      // Check if config exists
      const existing = await getSystemConfig(config_key, companyId);

      if (existing) {
        // Update existing
        await updateSystemConfig(config_key, {
          config_value,
          is_sensitive,
          is_editable
        }, companyId, userId);
      } else {
        // Create new
        await createSystemConfig({
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          company_id: companyId
        }, userId);
      }

      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        key: config.config_key,
        error: err.message
      });
    }
  }

  // Invalidate all cache for company
  if (companyId) {
    await invalidateCompanyCache(companyId);
  }

  return results;
}

/**
 * Search system configs
 * @param {string} searchQuery - Search query
 * @param {number|null} companyId - Company ID
 * @param {string|null} category - Category filter
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Paginated results
 */
export async function searchSystemConfigs(searchQuery, companyId = null, category = null, page = 1, limit = 50) {
  try {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE is_active = true AND deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    // Company filter
    if (companyId) {
      whereClause += ` AND (company_id = $${paramCount++} OR company_id IS NULL)`;
      params.push(companyId);
    } else {
      whereClause += ` AND company_id IS NULL`;
    }

    // Category filter
    if (category) {
      whereClause += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    // Search query
    if (searchQuery) {
      whereClause += ` AND (config_key ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${searchQuery}%`);
      paramCount++;
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM system_configs
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get data
    const dataQuery = `
      SELECT 
        config_key,
        config_value,
        value_type,
        category,
        description,
        is_sensitive,
        is_editable,
        company_id,
        created_at,
        updated_at
      FROM system_configs
      ${whereClause}
      ORDER BY category, config_key
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;
    params.push(limit, offset);

    const dataResult = await pool.query(dataQuery, params);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (err) {
    console.error('Error searching system configs:', err);
    throw err;
  }
}

/**
 * Log config audit
 * @param {string} configKey - Config key
 * @param {string} action - Action (CREATE, UPDATE, DELETE)
 * @param {string|null} oldValue - Old value
 * @param {string|null} newValue - New value
 * @param {number} userId - User ID
 * @param {number|null} companyId - Company ID
 */
async function logConfigAudit(configKey, action, oldValue, newValue, userId, companyId = null) {
  try {
    await pool.query(`
      INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id,
        company_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      'system_configs',
      configKey,
      action,
      oldValue ? JSON.stringify({ config_value: oldValue }) : null,
      newValue ? JSON.stringify({ config_value: newValue }) : null,
      userId,
      companyId
    ]);
  } catch (err) {
    console.error('Error logging config audit:', err);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Warm up cache for a company
 * @param {number|null} companyId - Company ID
 */
export async function warmupCache(companyId = null) {
  try {
    const configs = await getAllSystemConfigs(companyId);

    for (const config of configs) {
      const cacheKey = getCacheKey(config.company_id, config.config_key);
      await redis.setEx(cacheKey, CACHE_TTL_SECONDS, config.config_value);
    }

    console.log(`✅ Warmed up cache for ${configs.length} configs`);
  } catch (err) {
    console.error('Error warming up cache:', err);
  }
}

/**
 * Clear all system config cache
 */
export async function clearAllCache() {
  if (!isRedisReadyCheck()) return;

  try {
    const pattern = `${CACHE_PREFIX}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`✅ Cleared ${keys.length} cache keys`);
    }
  } catch (err) {
    console.error('Error clearing cache:', err);
  }
}

// ============================================================================
// CLEANUP ON EXIT
// ============================================================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down SystemConfig Service...');
  await pool.end();
  process.exit(0);
});

export default {
  getSystemConfig,
  getConfigNumber,
  getConfigBoolean,
  getConfigString,
  getConfigJSON,
  getAllSystemConfigs,
  getConfigsByCategory,
  createSystemConfig,
  updateSystemConfig,
  deleteSystemConfig,
  batchUpdateConfigs,
  exportSystemConfigs,
  importSystemConfigs,
  searchSystemConfigs,
  warmupCache,
  clearAllCache
};