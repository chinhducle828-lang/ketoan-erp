/**
 * Config Validator Middleware
 * ====================================================================
 * Validation middleware cho system_configs CRUD operations
 * ====================================================================
 */

import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for creating/updating system config
 */
export const configSchema = z.object({
  config_key: z.string()
    .min(3, 'Config key must be at least 3 characters')
    .max(255, 'Config key must not exceed 255 characters')
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 
      'Config key must be in format: category.name (lowercase, dots, no spaces)')
    .refine((key) => {
      // Prevent reserved keys
      const reservedKeys = ['id', 'created_at', 'updated_at', 'deleted_at', 'company_id', 'is_active'];
      return !reservedKeys.includes(key);
    }, 'Config key cannot be a reserved word'),
  
  config_value: z.string()
    .max(10000, 'Config value must not exceed 10000 characters')
    .refine((value) => {
      // Prevent SQL injection attempts
      const sqlInjectionPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
        /(UNION\s+SELECT)/i,
        /(--|\#|\/\*)/,
        /(\bOR\b\s+\d+\s*=\s*\d+)/i,
        /(\bAND\b\s+\d+\s*=\s*\d+)/i
      ];
      return !sqlInjectionPatterns.some(pattern => pattern.test(value));
    }, 'Config value contains invalid characters'),
  
  value_type: z.enum(['string', 'number', 'boolean', 'json', 'array'], {
    errorMap: () => ({ message: 'Value type must be one of: string, number, boolean, json, array' })
  }),
  
  category: z.string()
    .min(2, 'Category must be at least 2 characters')
    .max(100, 'Category must not exceed 100 characters')
    .regex(/^[A-Z][A-Z0-9_]*$/, 
      'Category must be uppercase letters, numbers, and underscores only (e.g., TAX_RATES)'),
  
  description: z.string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  
  is_sensitive: z.boolean().optional(),
  
  is_editable: z.boolean().optional(),
  
  company_id: z.number()
    .int('Company ID must be an integer')
    .positive('Company ID must be positive')
    .nullable()
    .optional()
});

/**
 * Schema for updating system config (partial update)
 */
export const updateConfigSchema = z.object({
  config_value: z.string()
    .max(10000, 'Config value must not exceed 10000 characters')
    .refine((value) => {
      const sqlInjectionPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
        /(UNION\s+SELECT)/i,
        /(--|\#|\/\*)/,
        /(\bOR\b\s+\d+\s*=\s*\d+)/i,
        /(\bAND\b\s+\d+\s*=\s*\d+)/i
      ];
      return !sqlInjectionPatterns.some(pattern => pattern.test(value));
    }, 'Config value contains invalid characters')
    .optional(),
  
  is_sensitive: z.boolean().optional(),
  
  is_editable: z.boolean().optional()
});

/**
 * Schema for batch update
 */
export const batchUpdateSchema = z.object({
  configs: z.array(z.object({
    key: z.string()
      .min(3, 'Config key must be at least 3 characters')
      .max(255, 'Config key must not exceed 255 characters'),
    value: z.string()
      .max(10000, 'Config value must not exceed 10000 characters')
  })).min(1, 'At least one config must be provided')
    .max(100, 'Cannot update more than 100 configs at once')
});

/**
 * Schema for search/filter
 */
export const searchConfigsSchema = z.object({
  category: z.string()
    .max(100, 'Category must not exceed 100 characters')
    .optional(),
  
  search: z.string()
    .max(255, 'Search query must not exceed 255 characters')
    .optional(),
  
  page: z.number()
    .int('Page must be an integer')
    .positive('Page must be positive')
    .default(1),
  
  limit: z.number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(100, 'Limit cannot exceed 100')
    .default(50)
});

/**
 * Schema for config key parameter
 */
export const configKeyParamSchema = z.object({
  key: z.string()
    .min(3, 'Config key must be at least 3 characters')
    .max(255, 'Config key must not exceed 255 characters')
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 
      'Config key must be in format: category.name')
});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate config value based on type
 * @param {string} value - Config value
 * @param {string} valueType - Value type
 * @returns {Object} Validation result { valid, error }
 */
export function validateConfigValueByType(value, valueType) {
  switch (valueType) {
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Value must be a string' };
      }
      return { valid: true, error: null };
    
    case 'number':
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return { valid: false, error: 'Value must be a valid number' };
      }
      return { valid: true, error: null };
    
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return { valid: false, error: 'Value must be "true" or "false"' };
      }
      return { valid: true, error: null };
    
    case 'json':
      try {
        JSON.parse(value);
        return { valid: true, error: null };
      } catch (err) {
        return { valid: false, error: 'Value must be valid JSON' };
      }
    
    case 'array':
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return { valid: false, error: 'Value must be a JSON array' };
        }
        return { valid: true, error: null };
      } catch (err) {
        return { valid: false, error: 'Value must be a valid JSON array' };
      }
    
    default:
      return { valid: false, error: `Unknown value type: ${valueType}` };
  }
}

/**
 * Validate config key format
 * @param {string} key - Config key
 * @returns {Object} Validation result { valid, error }
 */
export function validateConfigKeyFormat(key) {
  const pattern = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
  
  if (!pattern.test(key)) {
    return {
      valid: false,
      error: 'Config key must be in format: category.name (lowercase, dots, no spaces)'
    };
  }
  
  // Check for reserved words
  const reservedKeys = ['id', 'created_at', 'updated_at', 'deleted_at', 'company_id', 'is_active'];
  const parts = key.split('.');
  
  for (const part of parts) {
    if (reservedKeys.includes(part)) {
      return {
        valid: false,
        error: `Config key cannot contain reserved word: ${part}`
      };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Validate category format
 * @param {string} category - Category name
 * @returns {Object} Validation result { valid, error }
 */
export function validateCategoryFormat(category) {
  const pattern = /^[A-Z][A-Z0-9_]*$/;
  
  if (!pattern.test(category)) {
    return {
      valid: false,
      error: 'Category must be uppercase letters, numbers, and underscores only (e.g., TAX_RATES)'
    };
  }
  
  return { valid: true, error: null };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Validate create config request
 */
export function validateCreateConfig(req, res, next) {
  try {
    const validated = configSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid request data',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
}

/**
 * Validate update config request
 */
export function validateUpdateConfig(req, res, next) {
  try {
    const validated = updateConfigSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid request data',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
}

/**
 * Validate batch update request
 */
export function validateBatchUpdate(req, res, next) {
  try {
    const validated = batchUpdateSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid request data',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
}

/**
 * Validate search/filter request
 */
export function validateSearchConfigs(req, res, next) {
  try {
    const validated = searchConfigsSchema.parse(req.query);
    req.query = validated;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid query parameters',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
}

/**
 * Validate config key parameter
 */
export function validateConfigKey(req, res, next) {
  try {
    const validated = configKeyParamSchema.parse({ key: req.params.key });
    req.params.key = validated.key;
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid config key',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Validation error',
      message: err.message
    });
  }
}

export default {
  validateCreateConfig,
  validateUpdateConfig,
  validateBatchUpdate,
  validateSearchConfigs,
  validateConfigKey,
  validateConfigValueByType,
  validateConfigKeyFormat,
  validateCategoryFormat
};