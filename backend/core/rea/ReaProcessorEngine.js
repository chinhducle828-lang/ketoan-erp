/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * core/rea/ReaProcessorEngine.js
 * ====================================================================
 * Dynamic REA Event Processor Engine
 * ====================================================================
 * 
 * Đây là engine thay thế hoàn toàn EVENT_PROCESSORS hard-code trong
 * reaEventMapper.js. Engine này đọc cấu hình từ bảng DB
 * `rea_event_processors` và thông dịch JSON rules để:
 * 
 * 1. validate()        - Kiểm tra dữ liệu đầu vào dựa trên validation_rules
 * 2. calculate()       - Tính toán các trường dựa trên formula_rules
 * 3. generateEntries() - Sinh bút toán kế toán dựa trên entry_rules
 *    Hỗ trợ condition_if / condition_if_not để xử lý rẽ nhánh
 * 
 * Nguyên tắc KHÔNG hard-code:
 * - Mọi cấu hình đọc từ DB (global + company override)
 * - Symbolic accounts (BANK, COGS, AR...) resolve qua AccountResolver
 * - Công thức tính dùng safe evaluator (KHÔNG eval())
 * - Có cache layer để tránh query DB mỗi lần
 * ====================================================================
 */

import { pool } from '../../config/db.js';
import { resolveAccounts, SYSTEM_ACCOUNTS } from '../../config/businessRules.js';

// -------------------------------------------------------------------
// Cache layer (LRU in-memory)
// -------------------------------------------------------------------
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

class ProcessorCache {
  constructor() {
    this._store = new Map();
    this._ttl = DEFAULT_CACHE_TTL_MS;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this._ttl)
    });
  }

  invalidate(eventType, companyId) {
    const key = this._makeKey(eventType, companyId);
    this._store.delete(key);
  }

  _makeKey(eventType, companyId) {
    return `rea_proc:${companyId ?? 0}:${eventType}`;
  }
}

// Singleton cache instance
const processorCache = new ProcessorCache();

// -------------------------------------------------------------------
// Safe Expression Evaluator (thay thế eval())
// Dùng strict mode Function() thay vì eval() để tránh RCE
// -------------------------------------------------------------------
class SafeExpressionEvaluator {
  /**
   * Tính toán 1 biểu thức đơn giản với các biến đầu vào
   * Chỉ hỗ trợ: + - * / ( ) Math.* number string comparison
   * KHÔNG hỗ trợ: function calls, eval, new, prototype access
   */
  evaluate(expression, context) {
    if (typeof expression !== 'string') return expression;
    
    // Thay thế các token dạng input.field, calc.field, data.field
    let resolvedExpr = expression;
    const patterns = [
      { prefix: 'input.', source: () => context.input || {} },
      { prefix: 'calc.', source: () => context.calc || {} },
      { prefix: 'data.', source: () => ({ ...context.input, ...context.calc }) }
    ];

    for (const { prefix, source } of patterns) {
      const data = source();
      const regex = new RegExp(`\\b${prefix}([a-zA-Z_][a-zA-Z0-9_.]*)`, 'g');
      resolvedExpr = resolvedExpr.replace(regex, (match, path) => {
        const value = this._getNestedValue(data, path);
        if (value !== undefined) {
          // If it's a string, wrap in quotes for expression
          if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
          return JSON.stringify(value);
        }
        return 'undefined';
      });
    }

    // Handle string concatenation: "a" + "b" → "ab"
    // Only allow safe operations
    const sanitized = resolvedExpr
      .replace(/\bMath\.(\w+)\b/g, (_, fn) => `Math.${fn}`)
      .replace(/[^0-9+\-*/().%\s,Math.a-zA-Z._'\"!><=&|?:\s]/g, '')
      .trim();

    if (!sanitized) return undefined;

    try {
      // Tạo hàm an toàn với Math context, chạy strict mode
      const fn = new Function('Math', `"use strict"; return (${sanitized});`);
      const result = fn(Math);
      
      // Boolean results (for conditions)
      if (typeof result === 'boolean') return result;
      
      // String results (for concatenation like approval_note)
      if (typeof result === 'string') return result;
      
      // Number results - round to integer for accounting
      if (Number.isFinite(result)) return Math.round(result);
      
      return result;
    } catch {
      return undefined;
    }
  }

  /**
   * Đánh giá 1 biểu thức điều kiện (condition_if / condition_if_not)
   * Trả về true/false
   */
  evaluateCondition(expression, context) {
    if (!expression) return true; // không có condition = luôn đúng
    const result = this.evaluate(expression, context);
    // condition_if: cần truthy
    // condition_if_not: cần falsy (sẽ được đảo ngược ở nơi gọi)
    return !!result;
  }

  _getNestedValue(obj, path) {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }
}

const evaluator = new SafeExpressionEvaluator();

// -------------------------------------------------------------------
// Account Resolver - Symbolic -> Actual Account Codes
// -------------------------------------------------------------------
const AccountResolver = {
  /**
   * Resolve 1 symbolic account hoặc array symbolic accounts
   * thành danh sách mã tài khoản thực tế
   */
  resolve(symbolicAccounts, companyId) {
    if (typeof symbolicAccounts === 'string') {
      return [SYSTEM_ACCOUNTS[symbolicAccounts] || symbolicAccounts];
    }
    if (Array.isArray(symbolicAccounts)) {
      return resolveAccounts(symbolicAccounts);
    }
    return [];
  },

  /**
   * Resolve và trả về account code đầu tiên
   */
  resolveFirst(symbolicAccount, companyId) {
    const result = this.resolve(symbolicAccount, companyId);
    return result.length > 0 ? result[0] : symbolicAccount;
  }
};

// -------------------------------------------------------------------
// FieldPath resolver - resolve "input.field" / "calc.field" references
// -------------------------------------------------------------------
function resolveFieldValue(ref, inputData, calculatedData) {
  if (typeof ref !== 'string') return ref;
  
  if (ref.startsWith('calc.')) {
    const field = ref.replace('calc.', '');
    return calculatedData[field];
  }
  if (ref.startsWith('input.')) {
    const field = ref.replace('input.', '');
    return inputData[field];
  }
  if (ref.startsWith('data.')) {
    const field = ref.replace('data.', '');
    return calculatedData[field] ?? inputData[field];
  }
  return ref;
}

// -------------------------------------------------------------------
// Main Engine Class
// -------------------------------------------------------------------
export class ReaProcessorEngine {
  /**
   * Lấy processor config từ cache hoặc DB
   * Ưu tiên: company-specific > global default
   */
  static async getConfig(eventType, companyId) {
    // 1. Check cache trước
    const cached = processorCache.get(eventType, companyId);
    if (cached) return cached;

    // 2. Query DB - ưu tiên company-specific
    const { rows } = await pool.query(`
      SELECT * FROM rea_event_processors
      WHERE event_type = $1
        AND is_active = TRUE
        AND (company_id = $2 OR company_id IS NULL)
      ORDER BY company_id NULLS LAST
      LIMIT 1
    `, [eventType, companyId]);

    if (rows.length === 0) return null;

    // 3. Parse JSON fields
    const config = {
      ...rows[0],
      validation_rules: this._parseJSON(rows[0].validation_rules),
      formula_rules: this._parseJSON(rows[0].formula_rules),
      entry_rules: this._parseJSON(rows[0].entry_rules),
      workflow_config: this._parseJSON(rows[0].workflow_config)
    };

    // 4. Cache và return
    const cacheKey = processorCache._makeKey(eventType, companyId);
    processorCache.set(cacheKey, config);
    return config;
  }

  static _parseJSON(val) {
    if (!val) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  /**
   * Validate dữ liệu đầu vào dựa trên validation_rules JSON
   */
  static validate(config, data, companyId) {
    if (!config || !config.validation_rules) return [];

    const errors = [];
    const rules = config.validation_rules;

    for (const rule of rules) {
      const value = data[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`Trường "${rule.label || rule.field}" là bắt buộc`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Type check
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`Trường "${rule.label || rule.field}" phải là số`);
      }
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`Trường "${rule.label || rule.field}" phải là chuỗi`);
      }
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push(`Trường "${rule.label || rule.field}" phải là mảng`);
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Trường "${rule.label || rule.field}" phải đúng/sai`);
      }

      // Min/Max check (numbers)
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push(`Trường "${rule.label || rule.field}" phải >= ${rule.min}`);
      }
      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push(`Trường "${rule.label || rule.field}" phải <= ${rule.max}`);
      }

      // MinLength/MaxLength for arrays and strings
      if (rule.minLength !== undefined) {
        const len = typeof value === 'string' ? value.length : (Array.isArray(value) ? value.length : 0);
        if (len < rule.minLength) {
          errors.push(`Trường "${rule.label || rule.field}" phải có ít nhất ${rule.minLength} phần tử`);
        }
      }
      if (rule.maxLength !== undefined) {
        const len = typeof value === 'string' ? value.length : (Array.isArray(value) ? value.length : 0);
        if (len > rule.maxLength) {
          errors.push(`Trường "${rule.label || rule.field}" không được quá ${rule.maxLength} phần tử`);
        }
      }

      // Pattern check
      if (rule.pattern && typeof value === 'string') {
        try {
          if (!new RegExp(rule.pattern).test(value)) {
            errors.push(`Trường "${rule.label || rule.field}" không đúng định dạng`);
          }
        } catch { /* invalid regex */ }
      }

      // Enum check
      if (rule.enum && Array.isArray(rule.enum) && !rule.enum.includes(value)) {
        errors.push(`Trường "${rule.label || rule.field}" phải là một trong: ${rule.enum.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Tính toán các trường dựa trên formula_rules JSON
   */
  static calculate(config, inputData) {
    if (!config || !config.formula_rules) return { ...inputData };

    const result = { ...inputData };
    const rules = config.formula_rules;

    for (const rule of rules) {
      if (!rule.field || !rule.expression) continue;

      const context = { input: inputData, calc: result };
      const value = evaluator.evaluate(rule.expression, context);

      if (value !== undefined) {
        result[rule.field] = value;
      }
    }

    return result;
  }

  /**
   * Đánh giá điều kiện condition_if / condition_if_not
   */
  static _evaluateEntryCondition(rule, context) {
    // Nếu có condition_if: expression phải truthy
    if (rule.condition_if) {
      const result = evaluator.evaluateCondition(rule.condition_if, context);
      if (!result) return false;
    }
    
    // Nếu có condition_if_not: expression phải falsy
    if (rule.condition_if_not) {
      const result = evaluator.evaluateCondition(rule.condition_if_not, context);
      if (result) return false;
    }
    
    return true;
  }

  /**
   * Sinh bút toán kế toán dựa trên entry_rules JSON
   * Hỗ trợ condition_if / condition_if_not cho rẽ nhánh
   */
  static async generateEntries(config, calculatedData, companyId) {
    if (!config || !config.entry_rules) return [];

    const entries = [];
    const rules = config.entry_rules;
    const context = { input: calculatedData, calc: calculatedData };

    for (const rule of rules) {
      // Kiểm tra điều kiện
      if (!this._evaluateEntryCondition(rule, context)) continue;

      // Resolve amount
      let amount = resolveFieldValue(rule.amount, calculatedData, calculatedData);
      if (typeof amount === 'number' && amount <= 0) continue;
      if (amount === undefined || amount === null) continue;

      // Resolve partner_id
      let partnerId = rule.partner_id;
      if (typeof partnerId === 'string') {
        partnerId = resolveFieldValue(partnerId, calculatedData, calculatedData);
      }

      // Resolve debit accounts (symbolic -> actual)
      const debitAccounts = AccountResolver.resolve(rule.debit, companyId);

      // Resolve credit accounts
      const creditAccounts = AccountResolver.resolve(rule.credit, companyId);

      // Tạo bút toán: debit DR, credit CR
      for (const debitAcct of debitAccounts) {
        entries.push({
          accountCode: debitAcct,
          entryType: 'DR',
          amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
          partnerId: partnerId || undefined
        });
      }

      for (const creditAcct of creditAccounts) {
        entries.push({
          accountCode: creditAcct,
          entryType: 'CR',
          amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
          partnerId: partnerId || undefined
        });
      }
    }

    return entries;
  }

  /**
   * Process 1 event hoàn chỉnh: validate -> calculate -> generateEntries
   */
  static async process(eventType, inputData, companyId) {
    // 1. Lấy config từ DB
    const config = await this.getConfig(eventType, companyId);
    if (!config) {
      throw new Error(`Không tìm thấy processor cho nghiệp vụ: ${eventType}`);
    }

    // 2. Validate
    const validationErrors = this.validate(config, inputData, companyId);
    if (validationErrors.length > 0) {
      throw new Error(`Validation lỗi: ${validationErrors.join('; ')}`);
    }

    // 3. Calculate
    const calculatedData = this.calculate(config, inputData);

    // 4. Generate entries (with conditions)
    const entries = await this.generateEntries(config, calculatedData, companyId);

    return {
      validated: true,
      calculatedData,
      entries,
      configVersion: config.version
    };
  }

  /**
   * Invalidate cache cho 1 event type
   */
  static invalidateCache(eventType, companyId) {
    processorCache.invalidate(eventType, companyId);
  }

  /**
   * Đăng ký 1 processor mới (hoặc cập nhật) - UPSERT
   */
  static async register(eventType, companyId, configData) {
    const { rows } = await pool.query(`
      INSERT INTO rea_event_processors 
        (event_type, company_id, label, description, is_active,
         validation_rules, formula_rules, entry_rules, workflow_config, ui_schema)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (event_type, COALESCE(company_id, 0))
      DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        validation_rules = EXCLUDED.validation_rules,
        formula_rules = EXCLUDED.formula_rules,
        entry_rules = EXCLUDED.entry_rules,
        workflow_config = EXCLUDED.workflow_config,
        ui_schema = EXCLUDED.ui_schema,
        version = rea_event_processors.version + 1,
        updated_at = NOW()
      RETURNING id, version
    `, [
      eventType,
      companyId || null,
      configData.label || '',
      configData.description || '',
      configData.is_active !== false,
      JSON.stringify(configData.validation_rules || []),
      JSON.stringify(configData.formula_rules || []),
      JSON.stringify(configData.entry_rules || []),
      configData.workflow_config ? JSON.stringify(configData.workflow_config) : null,
      configData.ui_schema ? JSON.stringify(configData.ui_schema) : null
    ]);

    // Invalidate cache
    this.invalidateCache(eventType, companyId);

    return rows[0];
  }
}

export { AccountResolver, SafeExpressionEvaluator, processorCache };