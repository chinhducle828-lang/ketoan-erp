/**
 * Config Helper Utilities
 * ====================================================================
 * Helper functions để đọc system configs từ database
 * Sử dụng trong các services và controllers
 * ====================================================================
 */

import { getConfigNumber, getConfigBoolean, getConfigString, getConfigJSON, getSystemConfig } from '../services/systemConfig.service.js';

/**
 * Get system config value (generic)
 * @param {string} configKey - Config key
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string|null>} Config value
 */
export async function getConfig(configKey, companyId = null) {
  return getSystemConfig(configKey, companyId);
}

// ============================================================================
// TAX RATES HELPERS
// ============================================================================

/**
 * Get standard VAT rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} VAT rate (default: 8%)
 */
export async function getStandardVatRate(companyId = null) {
  return getConfigNumber('tax.standard_vat_rate', 8, companyId) / 100;
}

/**
 * Get service VAT rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} VAT rate (default: 10%)
 */
export async function getServiceVatRate(companyId = null) {
  return getConfigNumber('tax.service_vat_rate', 10, companyId) / 100;
}

/**
 * Get corporate tax rate by revenue
 * @param {number} revenue - Annual revenue
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Corporate tax rate
 */
export async function getCorporateTaxRate(revenue, companyId = null) {
  const tier1Threshold = await getConfigNumber('financial.revenue_tier1_threshold', 3000000000, companyId);
  const tier2Threshold = await getConfigNumber('financial.revenue_tier2_threshold', 50000000000, companyId);
  const rate1 = await getConfigNumber('tax.corporate_rate_tier1', 15, companyId) / 100;
  const rate2 = await getConfigNumber('tax.corporate_rate_tier2', 17, companyId) / 100;
  const rate3 = await getConfigNumber('tax.corporate_rate_tier3', 20, companyId) / 100;

  if (revenue <= tier1Threshold) return rate1;
  if (revenue <= tier2Threshold) return rate2;
  return rate3;
}

/**
 * Get factoring fee rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Fee rate (default: 2%)
 */
export async function getFactoringFeeRate(companyId = null) {
  return getConfigNumber('tax.factoring_fee_rate', 2, companyId) / 100;
}

/**
 * Get advance rate default
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Advance rate (default: 80%)
 */
export async function getAdvanceRateDefault(companyId = null) {
  return getConfigNumber('tax.advance_rate_default', 80, companyId) / 100;
}

/**
 * Get early payment discount rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Discount rate (default: 2%)
 */
export async function getEarlyPaymentDiscountRate(companyId = null) {
  return getConfigNumber('tax.early_payment_discount', 2, companyId) / 100;
}

/**
 * Get max discount rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max discount rate (default: 15%)
 */
export async function getMaxDiscountRate(companyId = null) {
  return getConfigNumber('tax.max_discount_rate', 15, companyId) / 100;
}

/**
 * Get employer insurance rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Insurance rate (default: 21.5%)
 */
export async function getEmployerInsuranceRate(companyId = null) {
  return getConfigNumber('tax.employer_insurance_rate', 21.5, companyId) / 100;
}

/**
 * Get employee insurance rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Insurance rate (default: 10.5%)
 */
export async function getEmployeeInsuranceRate(companyId = null) {
  return getConfigNumber('tax.employee_insurance_rate', 10.5, companyId) / 100;
}

// ============================================================================
// FINANCIAL THRESHOLDS HELPERS
// ============================================================================

/**
 * Get depreciation annual rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Depreciation rate (default: 20%)
 */
export async function getDepreciationAnnualRate(companyId = null) {
  return getConfigNumber('financial.depreciation_annual_rate', 20, companyId) / 100;
}

/**
 * Get doubtful debt provision rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Provision rate (default: 10%)
 */
export async function getDoubtfulDebtProvisionRate(companyId = null) {
  return getConfigNumber('financial.doubtful_debt_provision_rate', 10, companyId) / 100;
}

/**
 * Get biological provision rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Provision rate (default: 5%)
 */
export async function getBiologicalProvisionRate(companyId = null) {
  return getConfigNumber('financial.biological_provision_rate', 5, companyId) / 100;
}

/**
 * Get amount precision
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Decimal places (default: 2)
 */
export async function getAmountPrecision(companyId = null) {
  return getConfigNumber('financial.amount_precision', 2, companyId);
}

/**
 * Get tax precision
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Decimal places (default: 2)
 */
export async function getTaxPrecision(companyId = null) {
  return getConfigNumber('financial.tax_precision', 2, companyId);
}

/**
 * Get minimum order quantity
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Min quantity (default: 1)
 */
export async function getMinOrderQuantity(companyId = null) {
  return getConfigNumber('financial.min_order_quantity', 1, companyId);
}

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Get rate limit window (ms)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Window in ms (default: 900000 = 15 minutes)
 */
export async function getRateLimitWindowMs(companyId = null) {
  return getConfigNumber('security.rate_limit_window_ms', 900000, companyId);
}

/**
 * Get rate limit max requests
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max requests (default: 100)
 */
export async function getRateLimitMaxRequests(companyId = null) {
  return getConfigNumber('security.rate_limit_max_requests', 100, companyId);
}

/**
 * Get session timeout (minutes)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Timeout in minutes (default: 120)
 */
export async function getSessionTimeoutMinutes(companyId = null) {
  return getConfigNumber('security.session_timeout_minutes', 120, companyId);
}

/**
 * Get API timeout (ms)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Timeout in ms (default: 30000)
 */
export async function getApiTimeoutMs(companyId = null) {
  return getConfigNumber('security.api_timeout_ms', 30000, companyId);
}

/**
 * Get API retry count
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Retry count (default: 3)
 */
export async function getApiRetryCount(companyId = null) {
  return getConfigNumber('security.api_retry_count', 3, companyId);
}

/**
 * Get max file size (MB)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max file size in MB (default: 10)
 */
export async function getMaxFileSizeMb(companyId = null) {
  return getConfigNumber('security.max_file_size_mb', 10, companyId);
}

/**
 * Get password min length
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Min length (default: 8)
 */
export async function getPasswordMinLength(companyId = null) {
  return getConfigNumber('security.password_min_length', 8, companyId);
}

/**
 * Get max login attempts
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max attempts (default: 5)
 */
export async function getMaxLoginAttempts(companyId = null) {
  return getConfigNumber('security.max_login_attempts', 5, companyId);
}

/**
 * Get lockout duration (minutes)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Duration in minutes (default: 15)
 */
export async function getLockoutDurationMinutes(companyId = null) {
  return getConfigNumber('security.lockout_duration_minutes', 15, companyId);
}

/**
 * Get JWT expiry (hours)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Expiry in hours (default: 24)
 */
export async function getJwtExpiryHours(companyId = null) {
  return getConfigNumber('security.jwt_expiry_hours', 24, companyId);
}

/**
 * Get OTP expiry (minutes)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Expiry in minutes (default: 5)
 */
export async function getOtpExpiryMinutes(companyId = null) {
  return getConfigNumber('security.otp_expiry_minutes', 5, companyId);
}

/**
 * Get API rate limit requests per minute
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Requests per minute (default: 100)
 */
export async function getApiRateLimitRequests(companyId = null) {
  return getConfigNumber('security.rate_limit_api_requests', 100, companyId);
}

// ============================================================================
// AI CONFIG HELPERS
// ============================================================================

/**
 * Get AI confidence auto-apply threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Threshold % (default: 95)
 */
export async function getAiConfidenceAutoApply(companyId = null) {
  return getConfigNumber('ai.confidence_auto_apply', 95, companyId);
}

/**
 * Get AI confidence HITL required threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Threshold % (default: 70)
 */
export async function getAiConfidenceHitlRequired(companyId = null) {
  return getConfigNumber('ai.confidence_hitl_required', 70, companyId);
}

/**
 * Get large transaction amount threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Amount in VND (default: 100,000,000)
 */
export async function getAiLargeTransactionAmount(companyId = null) {
  return getConfigNumber('ai.amount_large_transaction', 100000000, companyId);
}

/**
 * Get cashflow negative threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Amount in VND (default: -50,000,000)
 */
export async function getAiCashflowNegativeThreshold(companyId = null) {
  return getConfigNumber('ai.cashflow_negative_threshold', -50000000, companyId);
}

/**
 * Get inventory low stock threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Quantity (default: 10)
 */
export async function getAiInventoryLowStock(companyId = null) {
  return getConfigNumber('ai.inventory_low_stock', 10, companyId);
}

/**
 * Get aging overdue days
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Days (default: 90)
 */
export async function getAiAgingOverdueDays(companyId = null) {
  return getConfigNumber('ai.aging_overdue_days', 90, companyId);
}

/**
 * Get Gemini rate limit RPM
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} RPM (default: 15)
 */
export async function getAiGeminiRateLimitRpm(companyId = null) {
  return getConfigNumber('ai.gemini_rate_limit_rpm', 15, companyId);
}

/**
 * Get Gemini temperature
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Temperature (default: 0.7)
 */
export async function getAiGeminiTemperature(companyId = null) {
  return getConfigNumber('ai.gemini_temperature', 0.7, companyId);
}

/**
 * Get Gemini max tokens
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max tokens (default: 8192)
 */
export async function getAiGeminiMaxTokens(companyId = null) {
  return getConfigNumber('ai.gemini_max_tokens', 8192, companyId);
}

/**
 * Get Groq rate limit RPM
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} RPM (default: 30)
 */
export async function getAiGroqRateLimitRpm(companyId = null) {
  return getConfigNumber('ai.groq_rate_limit_rpm', 30, companyId);
}

/**
 * Get Gemini model
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Model name
 */
export async function getAiGeminiModel(companyId = null) {
  return getConfigString('ai.gemini_model', process.env.GEMINI_MODEL || 'gemini-2.5-flash', companyId);
}

/**
 * Get Groq model
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Model name
 */
export async function getAiGroqModel(companyId = null) {
  return getConfigString('ai.groq_model', process.env.GROQ_MODEL || 'mixtral-8x7b-32768', companyId);
}

/**
 * Get Gemini API key
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} API key
 */
export async function getAiGeminiApiKey(companyId = null) {
  return getConfigString('ai.gemini_api_key', process.env.GEMINI_API_KEY || '', companyId);
}

/**
 * Get Groq API key
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} API key
 */
export async function getAiGroqApiKey(companyId = null) {
  return getConfigString('ai.groq_api_key', process.env.GROQ_API_KEY || '', companyId);
}

/**
 * Get Cloudflare proxy enabled flag
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled
 */
export async function getAiUseCloudflareProxy(companyId = null) {
  return getConfigBoolean('ai.use_cloudflare_proxy', process.env.USE_CLOUDFLARE_PROXY === 'true', companyId);
}

/**
 * Get Cloudflare proxy URL
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} URL
 */
export async function getAiCloudflareProxyUrl(companyId = null) {
  return getConfigString('ai.cloudflare_proxy_url', process.env.CLOUDFLARE_PROXY_URL || '', companyId);
}

/**
 * Get max concurrent AI requests
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Requests
 */
export async function getAiMaxConcurrentRequests(companyId = null) {
  return getConfigNumber('ai.max_concurrent_requests', Number(process.env.MAX_CONCURRENT_REQUESTS) || 5, companyId);
}

/**
 * Get AI request timeout
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Timeout ms
 */
export async function getAiRequestTimeout(companyId = null) {
  return getConfigNumber('ai.request_timeout', Number(process.env.AI_REQUEST_TIMEOUT) || 30000, companyId);
}

/**
 * Get AI retry count
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Retries
 */
export async function getAiMaxRetries(companyId = null) {
  return getConfigNumber('ai.max_retries', Number(process.env.AI_MAX_RETRIES) || 3, companyId);
}

/**
 * Get AI retry delay
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Delay ms
 */
export async function getAiRetryDelay(companyId = null) {
  return getConfigNumber('ai.retry_delay', Number(process.env.AI_RETRY_DELAY) || 1000, companyId);
}

/**
 * Get Python AI service URL
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} URL
 */
export async function getAiPythonServiceUrl(companyId = null) {
  return getConfigString('ai.python_service_url', process.env.PYTHON_AI_SERVICE_URL || '', companyId);
}

/**
 * Get Gemini API keys list
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string[]>} Array of keys
 */
export async function getAiGeminiKeys(companyId = null) {
  const raw = await getConfigString('ai.gemini_keys', process.env.GEMINI_KEYS || '', companyId);
  return raw
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Get Groq API keys list
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string[]>} Array of keys
 */
export async function getAiGroqKeys(companyId = null) {
  const raw = await getConfigString('ai.groq_keys', process.env.GROQ_KEYS || '', companyId);
  return raw
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Get DeepSeek API keys list
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string[]>} Array of keys
 */
export async function getAiDeepSeekKeys(companyId = null) {
  const raw = await getConfigString('ai.deepseek_keys', process.env.DEEPSEEK_KEYS || '', companyId);
  return raw
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Get DeepSeek model
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Model name
 */
export async function getAiDeepSeekModel(companyId = null) {
  return getConfigString('ai.deepseek_model', process.env.DEEPSEEK_MODEL || 'deepseek-chat', companyId);
}

/**
 * Get DeepSeek API key
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} API key
 */
export async function getAiDeepSeekApiKey(companyId = null) {
  return getConfigString('ai.deepseek_api_key', process.env.DEEPSEEK_API_KEY || '', companyId);
}

/**
 * Get DeepSeek rate limit RPM
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} RPM (default: 60)
 */
export async function getAiDeepSeekRateLimitRpm(companyId = null) {
  return getConfigNumber('ai.deepseek_rate_limit_rpm', 60, companyId);
}

/**
 * Get batch parallel workers
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Workers (default: 5)
 */
export async function getAiBatchParallelWorkers(companyId = null) {
  return getConfigNumber('ai.batch_parallel_workers', 5, companyId);
}

/**
 * Get batch confidence threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Threshold % (default: 90)
 */
export async function getAiBatchConfidenceThreshold(companyId = null) {
  return getConfigNumber('ai.batch_confidence_threshold', 90, companyId);
}

/**
 * Get batch auto-approve threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Threshold % (default: 95)
 */
export async function getAiBatchAutoApproveThreshold(companyId = null) {
  return getConfigNumber('ai.batch_auto_approve_threshold', 95, companyId);
}

/**
 * Get batch timeout (minutes)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Timeout in minutes (default: 60)
 */
export async function getAiBatchTimeoutMinutes(companyId = null) {
  return getConfigNumber('ai.batch_timeout_minutes', 60, companyId);
}

/**
 * Get AI suggestion TTL (hours)
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} TTL in hours (default: 72)
 */
export async function getAiSuggestionTtlHours(companyId = null) {
  return getConfigNumber('ai.suggestion_ttl_hours', 72, companyId);
}

/**
 * Get anomaly detection threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Threshold % (default: 10)
 */
export async function getAiAnomalyDetectionThreshold(companyId = null) {
  return getConfigNumber('ai.anomaly_detection_threshold', 10, companyId);
}

// ============================================================================
// INVENTORY HELPERS
// ============================================================================

/**
 * Get low stock threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Quantity (default: 10)
 */
export async function getInventoryLowStockThreshold(companyId = null) {
  return getConfigNumber('inventory.low_stock_threshold', 10, companyId);
}

/**
 * Get FIFO enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: true)
 */
export async function getInventoryFifoEnabled(companyId = null) {
  return getConfigBoolean('inventory.fifo_enabled', true, companyId);
}

/**
 * Get auto reorder enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: false)
 */
export async function getInventoryAutoReorderEnabled(companyId = null) {
  return getConfigBoolean('inventory.auto_reorder_enabled', false, companyId);
}

/**
 * Get reorder point multiplier
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Multiplier (default: 1.5)
 */
export async function getInventoryReorderPointMultiplier(companyId = null) {
  return getConfigNumber('inventory.reorder_point_multiplier', 1.5, companyId);
}

/**
 * Get max stock level
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max level (default: 10000)
 */
export async function getInventoryMaxStockLevel(companyId = null) {
  return getConfigNumber('inventory.max_stock_level', 10000, companyId);
}

// ============================================================================
// CLOSING HELPERS
// ============================================================================

/**
 * Get closing lock days
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Days (default: 30)
 */
export async function getClosingLockDays(companyId = null) {
  return getConfigNumber('closing.lock_days', 30, companyId);
}

/**
 * Get auto close enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: true)
 */
export async function getClosingAutoCloseEnabled(companyId = null) {
  return getConfigBoolean('closing.auto_close_enabled', true, companyId);
}

/**
 * Get closing require approval
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Required (default: true)
 */
export async function getClosingRequireApproval(companyId = null) {
  return getConfigBoolean('closing.require_approval', true, companyId);
}

/**
 * Get closing voucher type
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Voucher type (default: 'CLOSING')
 */
export async function getClosingVoucherType(companyId = null) {
  return getConfigString('closing.voucher_type', 'CLOSING', companyId);
}

/**
 * Get closing default tax rate
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Tax rate % (default: 20)
 */
export async function getClosingDefaultTaxRate(companyId = null) {
  return getConfigNumber('closing.default_tax_rate', 20, companyId) / 100;
}

// ============================================================================
// VOUCHER HELPERS
// ============================================================================

/**
 * Get voucher auto numbering
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: true)
 */
export async function getVoucherAutoNumbering(companyId = null) {
  return getConfigBoolean('voucher.auto_numbering', true, companyId);
}

/**
 * Get voucher require approval threshold
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Amount in VND (default: 50,000,000)
 */
export async function getVoucherRequireApprovalThreshold(companyId = null) {
  return getConfigNumber('voucher.require_approval_threshold', 50000000, companyId);
}

/**
 * Get max items per voucher
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Max items (default: 50)
 */
export async function getVoucherMaxItemsPerVoucher(companyId = null) {
  return getConfigNumber('voucher.max_items_per_voucher', 50, companyId);
}

/**
 * Get voucher allow edit posted
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Allowed (default: false)
 */
export async function getVoucherAllowEditPosted(companyId = null) {
  return getConfigBoolean('voucher.allow_edit_posted', false, companyId);
}

/**
 * Get voucher default currency
 * @param {number|null} companyId - Company ID
 * @returns {Promise<string>} Currency (default: 'VND')
 */
export async function getVoucherDefaultCurrency(companyId = null) {
  return getConfigString('voucher.default_currency', 'VND', companyId);
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Get email notifications enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: true)
 */
export async function getNotificationEmailEnabled(companyId = null) {
  return getConfigBoolean('notification.email_enabled', true, companyId);
}

/**
 * Get SMS notifications enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: false)
 */
export async function getNotificationSmsEnabled(companyId = null) {
  return getConfigBoolean('notification.sms_enabled', false, companyId);
}

/**
 * Get push notifications enabled
 * @param {number|null} companyId - Company ID
 * @returns {Promise<boolean>} Enabled (default: true)
 */
export async function getNotificationPushEnabled(companyId = null) {
  return getConfigBoolean('notification.push_enabled', true, companyId);
}

/**
 * Get notification default limit
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Limit (default: 20)
 */
export async function getNotificationDefaultLimit(companyId = null) {
  return getConfigNumber('notification.default_limit', 20, companyId);
}

/**
 * Get notification retention days
 * @param {number|null} companyId - Company ID
 * @returns {Promise<number>} Days (default: 90)
 */
export async function getNotificationRetentionDays(companyId = null) {
  return getConfigNumber('notification.retention_days', 90, companyId);
}

// ============================================================================
// BATCH HELPERS (Để load nhiều configs cùng lúc)
// ============================================================================

/**
 * Get all tax rates at once
 * @param {number|null} companyId - Company ID
 * @returns {Promise<Object>} Object containing all tax rates
 */
export async function getAllTaxRates(companyId = null) {
  const [
    standardVatRate,
    serviceVatRate,
    corporateRateTier1,
    corporateRateTier2,
    corporateRateTier3,
    minimumCorporateRate,
    factoringFeeRate,
    advanceRateDefault,
    earlyPaymentDiscount,
    maxDiscountRate,
    employerInsuranceRate,
    employeeInsuranceRate
  ] = await Promise.all([
    getConfigNumber('tax.standard_vat_rate', 8, companyId),
    getConfigNumber('tax.service_vat_rate', 10, companyId),
    getConfigNumber('tax.corporate_rate_tier1', 15, companyId),
    getConfigNumber('tax.corporate_rate_tier2', 17, companyId),
    getConfigNumber('tax.corporate_rate_tier3', 20, companyId),
    getConfigNumber('tax.minimum_corporate_rate', 1.5, companyId),
    getConfigNumber('tax.factoring_fee_rate', 2, companyId),
    getConfigNumber('tax.advance_rate_default', 80, companyId),
    getConfigNumber('tax.early_payment_discount', 2, companyId),
    getConfigNumber('tax.max_discount_rate', 15, companyId),
    getConfigNumber('tax.employer_insurance_rate', 21.5, companyId),
    getConfigNumber('tax.employee_insurance_rate', 10.5, companyId)
  ]);

  return {
    standardVatRate: standardVatRate / 100,
    serviceVatRate: serviceVatRate / 100,
    corporateRateTier1: corporateRateTier1 / 100,
    corporateRateTier2: corporateRateTier2 / 100,
    corporateRateTier3: corporateRateTier3 / 100,
    minimumCorporateRate: minimumCorporateRate / 100,
    factoringFeeRate: factoringFeeRate / 100,
    advanceRateDefault: advanceRateDefault / 100,
    earlyPaymentDiscount: earlyPaymentDiscount / 100,
    maxDiscountRate: maxDiscountRate / 100,
    employerInsuranceRate: employerInsuranceRate / 100,
    employeeInsuranceRate: employeeInsuranceRate / 100
  };
}

/**
 * Get all financial thresholds at once
 * @param {number|null} companyId - Company ID
 * @returns {Promise<Object>} Object containing all financial thresholds
 */
export async function getAllFinancialThresholds(companyId = null) {
  const [
    revenueTier1Threshold,
    revenueTier2Threshold,
    depreciationAnnualRate,
    doubtfulDebtProvisionRate,
    biologicalProvisionRate,
    amountPrecision,
    taxPrecision,
    minOrderQuantity
  ] = await Promise.all([
    getConfigNumber('financial.revenue_tier1_threshold', 3000000000, companyId),
    getConfigNumber('financial.revenue_tier2_threshold', 50000000000, companyId),
    getConfigNumber('financial.depreciation_annual_rate', 20, companyId),
    getConfigNumber('financial.doubtful_debt_provision_rate', 10, companyId),
    getConfigNumber('financial.biological_provision_rate', 5, companyId),
    getConfigNumber('financial.amount_precision', 2, companyId),
    getConfigNumber('financial.tax_precision', 2, companyId),
    getConfigNumber('financial.min_order_quantity', 1, companyId)
  ]);

  return {
    revenueTier1Threshold,
    revenueTier2Threshold,
    depreciationAnnualRate: depreciationAnnualRate / 100,
    doubtfulDebtProvisionRate: doubtfulDebtProvisionRate / 100,
    biologicalProvisionRate: biologicalProvisionRate / 100,
    amountPrecision,
    taxPrecision,
    minOrderQuantity
  };
}

/**
 * Get all AI configs at once
 * @param {number|null} companyId - Company ID
 * @returns {Promise<Object>} Object containing all AI configs
 */
export async function getAllAiConfigs(companyId = null) {
  const [
    confidenceAutoApply,
    confidenceHitlRequired,
    amountLargeTransaction,
    cashflowNegativeThreshold,
    inventoryLowStock,
    agingOverdueDays,
    geminiRateLimitRpm,
    groqRateLimitRpm,
    geminiTemperature,
    geminiMaxTokens,
    geminiModel,
    groqModel,
    useCloudflareProxy,
    cloudflareProxyUrl,
    maxConcurrentRequests,
    requestTimeout,
    maxRetries,
    retryDelay,
    pythonServiceUrl,
    batchParallelWorkers,
    batchConfidenceThreshold,
    batchAutoApproveThreshold,
    batchTimeoutMinutes,
    suggestionTtlHours,
    anomalyDetectionThreshold
  ] = await Promise.all([
    getConfigNumber('ai.confidence_auto_apply', 95, companyId),
    getConfigNumber('ai.confidence_hitl_required', 70, companyId),
    getConfigNumber('ai.amount_large_transaction', 100000000, companyId),
    getConfigNumber('ai.cashflow_negative_threshold', -50000000, companyId),
    getConfigNumber('ai.inventory_low_stock', 10, companyId),
    getConfigNumber('ai.aging_overdue_days', 90, companyId),
    getConfigNumber('ai.gemini_rate_limit_rpm', 15, companyId),
    getConfigNumber('ai.groq_rate_limit_rpm', 30, companyId),
    getConfigNumber('ai.gemini_temperature', 0.7, companyId),
    getConfigNumber('ai.gemini_max_tokens', 8192, companyId),
    getConfigString('ai.gemini_model', process.env.GEMINI_MODEL || 'gemini-2.5-flash', companyId),
    getConfigString('ai.groq_model', process.env.GROQ_MODEL || 'mixtral-8x7b-32768', companyId),
    getConfigBoolean('ai.use_cloudflare_proxy', process.env.USE_CLOUDFLARE_PROXY === 'true', companyId),
    getConfigString('ai.cloudflare_proxy_url', process.env.CLOUDFLARE_PROXY_URL || '', companyId),
    getConfigNumber('ai.max_concurrent_requests', Number(process.env.MAX_CONCURRENT_REQUESTS) || 5, companyId),
    getConfigNumber('ai.request_timeout', Number(process.env.AI_REQUEST_TIMEOUT) || 30000, companyId),
    getConfigNumber('ai.max_retries', Number(process.env.AI_MAX_RETRIES) || 3, companyId),
    getConfigNumber('ai.retry_delay', Number(process.env.AI_RETRY_DELAY) || 1000, companyId),
    getConfigString('ai.python_service_url', process.env.PYTHON_AI_SERVICE_URL || '', companyId),
    getConfigNumber('ai.batch_parallel_workers', 5, companyId),
    getConfigNumber('ai.batch_confidence_threshold', 90, companyId),
    getConfigNumber('ai.batch_auto_approve_threshold', 95, companyId),
    getConfigNumber('ai.batch_timeout_minutes', 60, companyId),
    getConfigNumber('ai.suggestion_ttl_hours', 72, companyId),
    getConfigNumber('ai.anomaly_detection_threshold', 10, companyId)
  ]);

  return {
    confidenceAutoApply,
    confidenceHitlRequired,
    amountLargeTransaction,
    cashflowNegativeThreshold,
    inventoryLowStock,
    agingOverdueDays,
    geminiRateLimitRpm,
    groqRateLimitRpm,
    geminiTemperature,
    geminiMaxTokens,
    geminiModel,
    groqModel,
    useCloudflareProxy,
    cloudflareProxyUrl,
    maxConcurrentRequests,
    requestTimeout,
    maxRetries,
    retryDelay,
    pythonServiceUrl,
    batchParallelWorkers,
    batchConfidenceThreshold,
    batchAutoApproveThreshold,
    batchTimeoutMinutes,
    suggestionTtlHours,
    anomalyDetectionThreshold
  };
}

// ============================================================================
// EXPORT ALL HELPERS
// ============================================================================

// Named exports for direct import
export { getConfigNumber, getConfigBoolean, getConfigString, getConfigJSON };

// Default export
export default {
  // Tax rates
  getStandardVatRate,
  getServiceVatRate,
  getCorporateTaxRate,
  getFactoringFeeRate,
  getAdvanceRateDefault,
  getEarlyPaymentDiscountRate,
  getMaxDiscountRate,
  getEmployerInsuranceRate,
  getEmployeeInsuranceRate,
  
  // Financial thresholds
  getDepreciationAnnualRate,
  getDoubtfulDebtProvisionRate,
  getBiologicalProvisionRate,
  getAmountPrecision,
  getTaxPrecision,
  getMinOrderQuantity,
  
  // Security
  getRateLimitWindowMs,
  getRateLimitMaxRequests,
  getSessionTimeoutMinutes,
  getApiTimeoutMs,
  getApiRetryCount,
  getMaxFileSizeMb,
  getPasswordMinLength,
  getMaxLoginAttempts,
  getLockoutDurationMinutes,
  getJwtExpiryHours,
  getOtpExpiryMinutes,
  getApiRateLimitRequests,
  
  // AI configs
  getAiConfidenceAutoApply,
  getAiConfidenceHitlRequired,
  getAiLargeTransactionAmount,
  getAiCashflowNegativeThreshold,
  getAiInventoryLowStock,
  getAiAgingOverdueDays,
  getAiGeminiRateLimitRpm,
  getAiGroqRateLimitRpm,
  getAiDeepSeekRateLimitRpm,
  getAiGeminiTemperature,
  getAiGeminiMaxTokens,
  getAiGeminiModel,
  getAiGroqModel,
  getAiDeepSeekModel,
  getAiGeminiApiKey,
  getAiGroqApiKey,
  getAiDeepSeekApiKey,
  getAiUseCloudflareProxy,
  getAiCloudflareProxyUrl,
  getAiMaxConcurrentRequests,
  getAiRequestTimeout,
  getAiMaxRetries,
  getAiRetryDelay,
  getAiPythonServiceUrl,
  getAiBatchParallelWorkers,
  getAiBatchConfidenceThreshold,
  getAiBatchAutoApproveThreshold,
  getAiBatchTimeoutMinutes,
  getAiSuggestionTtlHours,
  getAiAnomalyDetectionThreshold,
  
  // Inventory
  getInventoryLowStockThreshold,
  getInventoryFifoEnabled,
  getInventoryAutoReorderEnabled,
  getInventoryReorderPointMultiplier,
  getInventoryMaxStockLevel,
  
  // Closing
  getClosingLockDays,
  getClosingAutoCloseEnabled,
  getClosingRequireApproval,
  getClosingVoucherType,
  getClosingDefaultTaxRate,
  
  // Voucher
  getVoucherAutoNumbering,
  getVoucherRequireApprovalThreshold,
  getVoucherMaxItemsPerVoucher,
  getVoucherAllowEditPosted,
  getVoucherDefaultCurrency,
  
  // Notification
  getNotificationEmailEnabled,
  getNotificationSmsEnabled,
  getNotificationPushEnabled,
  getNotificationDefaultLimit,
  getNotificationRetentionDays,
  
  // Batch helpers
  getAllTaxRates,
  getAllFinancialThresholds,
  getAllAiConfigs
};