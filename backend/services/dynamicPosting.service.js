/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * dynamicPosting.service.js - Dynamic Posting Engine
 * 
 * Mục tiêu: Loại bỏ hard-code account numbers trong reaEventMapper.js
 * Bằng cách đọc rules từ bảng accounting_posting_rules và resolve
 * account keys qua bảng account_resolvers.
 * 
 * @FLOW:
 * 1. getRules(eventType, companyId) — Lấy rules từ DB (có cache)
 * 2. matchRule(rules, data) — Match rule_condition với event data
 * 3. resolveAccount(accountKey, companyId) — Resolve key → account_code
 * 4. evaluateExpression(expr, data) — Tính amount từ expression
 * 5. generateEntriesFromRules(rules, data, companyId) — Sinh entries
 * 
 * @CACHE: Rules được cache trong Redis với TTL = 300s.
 * Khi có sự thay đổi, cache bị invalidate.
 */

import { pool } from '../config/db.js';
import { redis as redisClient, isRedisReadyCheck } from '../cache/redis.js';

const CACHE_TTL = 300; // 5 phút
const RULES_CACHE_PREFIX = 'posting_rules:';
const RESOLVER_CACHE_PREFIX = 'account_resolver:';

// ====================================================================
// Helper: Evaluate simple expression từ data object
// Hỗ trợ: field name, number, toán tử +, -, *, || (default value)
// ====================================================================
function evaluateExpression(expression, data) {
  if (typeof expression === 'number') return expression;
  if (typeof expression !== 'string') return 0;

  const cleaned = expression.trim();
  
  // Nếu là số thuần
  if (/^\d+(\.\d+)?$/.test(cleaned)) return parseFloat(cleaned);

  // Xử lý các expression đơn giản: "amount + goods_vat", "(transport_fee || 0) + transport_vat"
  // Pattern: field || default_value — dùng default nếu field null/undefined
  const tokenize = (expr) => {
    const tokens = [];
    let current = '';
    let inParen = 0;
    
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (ch === '(') { inParen++; current += ch; }
      else if (ch === ')') { inParen--; current += ch; }
      else if (inParen === 0 && ['+', '-', '*'].includes(ch)) {
        tokens.push(current.trim());
        tokens.push(ch);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  };

  const evaluateToken = (token) => {
    if (!token) return 0;
    token = token.trim();
    
    // Xử lý (field || default)
    const orMatch = token.match(/^\(?\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\|\|\s*(.+?)\s*\)?$/);
    if (orMatch) {
      const val = resolveField(data, orMatch[1].trim());
      if (val !== null && val !== undefined) return parseFloat(val) || 0;
      return evaluateExpression(orMatch[2].trim(), data);
    }

    // Xử lý field đơn thuần
    const val = resolveField(data, token);
    if (val !== null && val !== undefined) return parseFloat(val) || 0;
    
    // Xử lý số
    const num = parseFloat(token);
    if (!isNaN(num)) return num;
    
    return 0;
  };

  const tokens = tokenize(cleaned);
  if (tokens.length === 0) return 0;
  if (tokens.length === 1) return evaluateToken(tokens[0]);

  // Tính từ trái sang phải (không ưu tiên nhân chia — đơn giản)
  let result = evaluateToken(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const rightVal = evaluateToken(tokens[i + 1]);
    switch (operator) {
      case '+': result += rightVal; break;
      case '-': result -= rightVal; break;
      case '*': result *= rightVal; break;
    }
  }
  
  return Math.round(result);
}

// ====================================================================
// Helper: Resolve field từ data object (hỗ trợ nested path)
// ====================================================================
function resolveField(data, path) {
  if (!data || !path) return null;
  const parts = path.split('.');
  let current = data;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  return current;
}

// ====================================================================
// Helper: Match rule_condition với event data
// ====================================================================
function matchCondition(rule, data) {
  if (!rule.rule_condition) return true; // Không có condition → match all

  const condition = typeof rule.rule_condition === 'string'
    ? JSON.parse(rule.rule_condition)
    : rule.rule_condition;

  for (const [key, value] of Object.entries(condition)) {
    const dataValue = resolveField(data, key);
    if (dataValue === null || dataValue === undefined) return false;
    // So sánh linh hoạt: "true" với true, "0" với 0...
    if (String(dataValue) !== String(value)) return false;
  }
  return true;
}

// ====================================================================
// Core Functions
// ====================================================================

/**
 * Lấy posting rules cho 1 event_type + company_id
 * Có cache trong Redis
 */
async function getRules(eventType, companyId) {
  const cacheKey = `${RULES_CACHE_PREFIX}${companyId}:${eventType}`;
  
  // Thử cache trước
  if (isRedisReadyCheck()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      // Cache miss, tiếp tục query DB
    }
  }

  // Query DB - lấy tất cả rules active cho event_type này
  const { rows } = await pool.query(
    `SELECT id, event_type, rule_name, rule_condition, priority, debits, credits, metadata
     FROM accounting_posting_rules
     WHERE company_id = $1 AND event_type = $2 AND is_active = TRUE
     ORDER BY priority DESC`,
    [companyId, eventType]
  );

  // Parse JSON fields
  const rules = rows.map(r => ({
    ...r,
    rule_condition: r.rule_condition ? (
      typeof r.rule_condition === 'string' ? JSON.parse(r.rule_condition) : r.rule_condition
    ) : null,
    debits: typeof r.debits === 'string' ? JSON.parse(r.debits) : r.debits,
    credits: typeof r.credits === 'string' ? JSON.parse(r.credits) : r.credits,
    metadata: r.metadata ? (
      typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
    ) : {}
  }));

  // Cache result
  if (isRedisReadyCheck() && rules.length > 0) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(rules));
    } catch (e) {
      // Cache failure không ảnh hưởng core
    }
  }

  return rules;
}

/**
 * Invalidate cache cho 1 event_type + company_id
 */
async function invalidateRulesCache(eventType, companyId) {
  if (!isRedisReadyCheck()) return;
  
  try {
    const cacheKey = `${RULES_CACHE_PREFIX}${companyId}:${eventType}`;
    await redisClient.del(cacheKey);
  } catch (e) {
    // Silent fail
  }
}

/**
 * Invalidate ALL cache cho 1 company (khi có nhiều rules thay đổi)
 */
async function invalidateAllRulesCache(companyId) {
  if (!isRedisReadyCheck()) return;
  
  try {
    const keys = await redisClient.keys(`${RULES_CACHE_PREFIX}${companyId}:*`);
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (e) {
    // Silent fail
  }
}

/**
 * Resolve 1 account_key thành account_code thực tế
 * Hỗ trợ 4 loại resolver:
 *   - fixed: Trả về account_code cố định
 *   - jsonpath: Lấy từ event data theo JSONPath
 *   - lookup: Tra cứu từ bảng khác (VD: tài khoản theo partner type)
 *   - function: Gọi 1 function JS động
 */
async function resolveAccount(accountKey, companyId, data = {}) {
  const cacheKey = `${RESOLVER_CACHE_PREFIX}${companyId}:${accountKey}`;

  // Thử cache trước
  if (isRedisReadyCheck()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const resolver = JSON.parse(cached);
        return applyResolver(resolver, data);
      }
    } catch (e) {
      // Cache miss
    }
  }

  // Query DB
  const { rows } = await pool.query(
    `SELECT id, resolver_name, resolver_type, config
     FROM account_resolvers
     WHERE company_id = $1 AND resolver_name = $2 AND is_active = TRUE
     LIMIT 1`,
    [companyId, accountKey]
  );

  if (rows.length === 0) {
    // Fallback: coi accountKey chính là account_code (VD: "1111" → "1111")
    return accountKey;
  }

  const resolver = {
    ...rows[0],
    config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
  };

  // Cache resolver config
  if (isRedisReadyCheck()) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(resolver));
    } catch (e) {
      // Silent fail
    }
  }

  return applyResolver(resolver, data);
}

/**
 * Apply 1 resolver để lấy account_code
 */
function applyResolver(resolver, data) {
  const config = resolver.config;
  
  switch (resolver.resolver_type) {
    case 'fixed':
      return config.account_code || accountKey;

    case 'jsonpath':
      // Lấy account_code từ event data theo path
      // VD: config.path = "account_overrides.ar"
      return resolveField(data, config.path) || config.fallback || accountKey;

    case 'lookup':
      // Tra cứu động - sẽ implement khi cần
      // VD: lookup partner → tìm account_code theo partner_type
      return config.fallback || accountKey;

    case 'function':
      // Gọi function động - cảnh báo security
      // Chỉ cho phép các function đã đăng ký
      return callRegisteredFunction(config.function_name, data, config) || accountKey;

    default:
      return config.account_code || accountKey;
  }
}

/**
 * Danh sách function đã đăng ký cho resolver type 'function'
 * An toàn hơn eval() vì chỉ cho phép function đã định nghĩa sẵn
 */
const REGISTERED_FUNCTIONS = {};

/**
 * Đăng ký 1 function cho resolver
 */
function registerFunction(name, fn) {
  REGISTERED_FUNCTIONS[name] = fn;
}

/**
 * Gọi 1 function đã đăng ký
 */
function callRegisteredFunction(name, data, config) {
  if (!REGISTERED_FUNCTIONS[name]) return null;
  try {
    return REGISTERED_FUNCTIONS[name](data, config);
  } catch (e) {
    console.error(`[DynamicPosting] Function error: ${name}`, e.message);
    return null;
  }
}

/**
 * Generate entries từ matched rules
 * 
 * @param {Array} rules - Mảng rules từ getRules()
 * @param {Object} data - Event data (đã qua calculate)
 * @param {number} companyId
 * @returns {Array} Mảng entries [{ accountCode, entryType, amount, partnerId, companyId }]
 */
async function generateEntriesFromRules(rules, data, companyId) {
  if (!rules || rules.length === 0) {
    throw new Error(`Không tìm thấy posting rule cho event_type, company_id=${companyId}`);
  }

  const allEntries = [];

  for (const rule of rules) {
    // Kiểm tra condition
    if (!matchCondition(rule, data)) continue;

    // Xử lý debits
    for (const debit of rule.debits) {
      const accountCode = await resolveAccount(debit.account_key, companyId, data);
      const amount = evaluateExpression(debit.amount_expression, data);
      
      if (amount === 0) continue; // Bỏ qua entry 0

      allEntries.push({
        accountCode,
        entryType: 'DR',
        amount,
        partnerId: resolveField(data, debit.partner_field) || null,
        companyId: resolveField(data, debit.company_field) || null,
        dimensions: data.dimensions || {}
      });
    }

    // Xử lý credits
    for (const credit of rule.credits) {
      const accountCode = await resolveAccount(credit.account_key, companyId, data);
      const amount = evaluateExpression(credit.amount_expression, data);
      
      if (amount === 0) continue;

      allEntries.push({
        accountCode,
        entryType: 'CR',
        amount,
        partnerId: resolveField(data, credit.partner_field) || null,
        companyId: resolveField(data, credit.company_field) || null,
        dimensions: data.dimensions || {}
      });
    }
  }

  if (allEntries.length === 0) {
    throw new Error(`Không có rule nào match cho event data này. company_id=${companyId}`);
  }

  return allEntries;
}

/**
 * High-level API: 1 function để thay thế hoàn toàn generateEntries
 * trong các processor
 * 
 * @param {string} eventType - Loại nghiệp vụ (VD: 'sale', 'simple_sale')
 * @param {Object} data - Event data (đã qua calculate, chứa các trường cần thiết)
 * @param {number} companyId
 * @returns {Array} Mảng entries
 */
async function generateEntries(eventType, data, companyId) {
  const rules = await getRules(eventType, companyId);
  return generateEntriesFromRules(rules, data, companyId);
}

/**
 * Validate 1 rule mới trước khi lưu
 * Kiểm tra: parse JSON, evaluate expression thử, resolve account thử
 */
async function validateRule(rule, companyId) {
  const errors = [];

  // Kiểm tra debits
  if (!rule.debits || !Array.isArray(rule.debits) || rule.debits.length === 0) {
    errors.push('Phải có ít nhất 1 debit entry');
  } else {
    rule.debits.forEach((d, i) => {
      if (!d.account_key) errors.push(`debit[${i}]: thiếu account_key`);
      if (!d.amount_expression) errors.push(`debit[${i}]: thiếu amount_expression`);
    });
  }

  // Kiểm tra credits
  if (!rule.credits || !Array.isArray(rule.credits) || rule.credits.length === 0) {
    errors.push('Phải có ít nhất 1 credit entry');
  } else {
    rule.credits.forEach((c, i) => {
      if (!c.account_key) errors.push(`credit[${i}]: thiếu account_key`);
      if (!c.amount_expression) errors.push(`credit[${i}]: thiếu amount_expression`);
    });
  }

  // Kiểm tra event_type
  if (!rule.event_type) errors.push('Thiếu event_type');

  // Kiểm tra rule_condition có parse được JSON không
  if (rule.rule_condition && typeof rule.rule_condition === 'string') {
    try {
      JSON.parse(rule.rule_condition);
    } catch (e) {
      errors.push('rule_condition không phải JSON hợp lệ');
    }
  }

  // Kiểm tra account_key có resolve được không
  const allKeys = new Set();
  (rule.debits || []).forEach(d => allKeys.add(d.account_key));
  (rule.credits || []).forEach(c => allKeys.add(c.account_key));
  
  for (const key of allKeys) {
    const resolved = await resolveAccount(key, companyId);
    if (!resolved || resolved === key) {
      // Warning: key không tìm thấy resolver, dùng fallback
      // Không phải lỗi critical
    }
  }

  // Kiểm tra cân bằng debit = credit (dùng sample data)
  if (rule.sample_data) {
    const testData = typeof rule.sample_data === 'string' 
      ? JSON.parse(rule.sample_data) 
      : rule.sample_data;
    
    const testEntries = await generateEntriesFromRules([rule], testData, companyId);
    const totalDr = testEntries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
    const totalCr = testEntries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
    
    if (Math.abs(totalDr - totalCr) > 0.01) {
      errors.push(`Tổng debit (${totalDr}) !== tổng credit (${totalCr}). Rule không cân bằng!`);
    }
  }

  return errors;
}

/**
 * Test 1 rule với sample data, trả về entries dự kiến
 */
async function testRule(rule, sampleData, companyId) {
  const entries = await generateEntriesFromRules([rule], sampleData, companyId);
  
  const totalDr = entries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
  const totalCr = entries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
  
  return {
    entries,
    total_debit: totalDr,
    total_credit: totalCr,
    is_balanced: Math.abs(totalDr - totalCr) < 0.01
  };
}

export {
  getRules,
  invalidateRulesCache,
  invalidateAllRulesCache,
  resolveAccount,
  generateEntriesFromRules,
  generateEntries,
  validateRule,
  testRule,
  registerFunction,
  REGISTERED_FUNCTIONS,
  evaluateExpression,
  matchCondition
};