/**
 * Phase 5: Configuration Management System
 * ====================================================================
 * Mục đích:
 * 1. Tạo indexes cho system_configs table
 * 2. Seed 81 config values vào database
 * 3. Tạo helper functions để đọc configs với cache
 *
 * Cách chạy:
 *   node scripts/migrate_phase5_config_management.js
 *
 * Hoặc qua npm:
 *   npm run migrate:phase5
 * ====================================================================
 */

import pkg from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// ============================================================================
// CONFIGURATION SEEDS
// ============================================================================

const CONFIG_SEEDS = [
  // ============================================================================
  // TAX_RATES (18 configs) - Thuế suất
  // ============================================================================
  {
    config_key: 'tax.standard_vat_rate',
    config_value: '8',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT chuẩn (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.service_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT dịch vụ (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.corporate_rate_tier1',
    config_value: '15',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế TNDN doanh thu ≤3 tỷ (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.corporate_rate_tier2',
    config_value: '17',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế TNDN doanh thu ≤50 tỷ (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.corporate_rate_tier3',
    config_value: '20',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế TNDN doanh thu >50 tỷ (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.minimum_corporate_rate',
    config_value: '1.5',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế TNDN tối thiểu (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.factoring_fee_rate',
    config_value: '2',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Phí factoring (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.advance_rate_default',
    config_value: '80',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Tỷ lệ ứng trước mặc định (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.early_payment_discount',
    config_value: '2',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Chiết khấu thanh toán sớm (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.max_discount_rate',
    config_value: '15',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Chiết khấu tối đa cho phép (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.employer_insurance_rate',
    config_value: '21.5',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'BHXH người lao động đóng (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.employee_insurance_rate',
    config_value: '10.5',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'BHXH người sử dụng lao động đóng (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.retroactive_rebate_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT cho retroactive rebate (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.purchase_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT đầu vào mua hàng (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.simple_sale_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT bán hàng đơn giản (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.simple_expense_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT chi phí đơn giản (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.sales_credit_vat_rate',
    config_value: '10',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Thuế GTGT bán hàng chịu (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'tax.payroll_insurance_rate',
    config_value: '32',
    value_type: 'number',
    category: 'TAX_RATES',
    description: 'Tổng BHXH (người lao động + NSDLĐ) (%)',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // FINANCIAL_THRESHOLDS (8 configs) - Ngưỡng tài chính
  // ============================================================================
  {
    config_key: 'financial.revenue_tier1_threshold',
    config_value: '3000000000',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Ngưỡng doanh thu bậc 1 thuế TNDN (VND)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.revenue_tier2_threshold',
    config_value: '50000000000',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Ngưỡng doanh thu bậc 2 thuế TNDN (VND)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.depreciation_annual_rate',
    config_value: '20',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Tỷ lệ khấu hao hàng năm (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.doubtful_debt_provision_rate',
    config_value: '10',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Tỷ lệ dự phòng nợ xấu (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.biological_provision_rate',
    config_value: '5',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Tỷ lệ dự phòng tài sản sinh học (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.amount_precision',
    config_value: '2',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Số chữ số thập phân cho tiền tệ',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.tax_precision',
    config_value: '2',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Số chữ số thập phân cho thuế',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'financial.min_order_quantity',
    config_value: '1',
    value_type: 'number',
    category: 'FINANCIAL_THRESHOLDS',
    description: 'Số lượng đặt hàng tối thiểu',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // SECURITY (12 configs) - Bảo mật
  // ============================================================================
  {
    config_key: 'security.rate_limit_window_ms',
    config_value: '900000',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Time window cho rate limit (ms) - 15 phút',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.rate_limit_max_requests',
    config_value: '100',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Số requests tối đa trong rate limit window',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.session_timeout_minutes',
    config_value: '120',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Session timeout (phút)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.api_timeout_ms',
    config_value: '30000',
    value_type: 'number',
    category: 'SECURITY',
    description: 'API call timeout (ms)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.api_retry_count',
    config_value: '3',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Số lần retry API calls',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.max_file_size_mb',
    config_value: '10',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Kích thước file upload tối đa (MB)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.password_min_length',
    config_value: '8',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Độ dài mật khẩu tối thiểu',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.max_login_attempts',
    config_value: '5',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Số lần đăng nhập sai tối đa',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.lockout_duration_minutes',
    config_value: '15',
    value_type: 'number',
    category: 'SECURITY',
    description: 'Thời gian khóa tài khoản sau khi đăng nhập sai (phút)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.jwt_expiry_hours',
    config_value: '24',
    value_type: 'number',
    category: 'SECURITY',
    description: 'JWT token expiry (giờ)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.otp_expiry_minutes',
    config_value: '5',
    value_type: 'number',
    category: 'SECURITY',
    description: 'OTP token expiry (phút)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'security.rate_limit_api_requests',
    config_value: '100',
    value_type: 'number',
    category: 'SECURITY',
    description: 'API rate limit requests per minute',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // AI_CONFIG (15 configs) - Cấu hình AI
  // ============================================================================
  {
    config_key: 'ai.confidence_auto_apply',
    config_value: '95',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Ngưỡng confidence để auto-apply AI suggestion (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.confidence_hitl_required',
    config_value: '70',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Ngưỡng confidence cần human review (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.amount_large_transaction',
    config_value: '100000000',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Giao dịch lớn cần review (VND) - 100 triệu',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.cashflow_negative_threshold',
    config_value: '-50000000',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Cảnh báo cashflow âm (VND) - 50 triệu',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.inventory_low_stock',
    config_value: '10',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Cảnh báo tồn kho thấp (số lượng)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.aging_overdue_days',
    config_value: '90',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Công nợ quá hạn cảnh báo (ngày)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_rate_limit_rpm',
    config_value: '15',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Gemini API rate limit (requests per minute)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_temperature',
    config_value: '0.7',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Gemini AI temperature (0-1)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_max_tokens',
    config_value: '8192',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Gemini max tokens per request',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.batch_parallel_workers',
    config_value: '5',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Số workers xử lý AI batch jobs',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.batch_confidence_threshold',
    config_value: '90',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Ngưỡng confidence cho batch processing (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.batch_auto_approve_threshold',
    config_value: '95',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Ngưỡng auto-approve cho batch jobs (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.batch_timeout_minutes',
    config_value: '60',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Batch job timeout (phút)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.suggestion_ttl_hours',
    config_value: '72',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Thời gian sống của AI suggestion (giờ)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.anomaly_detection_threshold',
    config_value: '10',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Ngưỡng phát hiện bất thường (%)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_keys',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Danh sách Gemini API keys, ngăn cách bằng dấu phẩy',
    is_sensitive: true,
    is_editable: true
  },
  {
    config_key: 'ai.groq_keys',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Danh sách Groq API keys, ngăn cách bằng dấu phẩy',
    is_sensitive: true,
    is_editable: true
  },
  {
    config_key: 'ai.use_cloudflare_proxy',
    config_value: 'false',
    value_type: 'boolean',
    category: 'AI_CONFIG',
    description: 'Sử dụng Cloudflare proxy cho AI requests',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.cloudflare_proxy_url',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'URL Cloudflare proxy để đẩy request đến AI providers',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.max_concurrent_requests',
    config_value: '5',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Số request AI tối đa chạy đồng thời',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.request_timeout',
    config_value: '30000',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Timeout cho request tới AI provider (ms)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.max_retries',
    config_value: '3',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Số lần retry khi request AI thất bại',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.retry_delay',
    config_value: '1000',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Delay giữa các lần retry AI request (ms)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.python_service_url',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'URL của Python AI service (fallback)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_model',
    config_value: 'gemini-2.5-flash',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Model Gemini sử dụng',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.groq_model',
    config_value: 'mixtral-8x7b-32768',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Model Groq sử dụng',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'ai.gemini_api_key',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Gemini single-key API key fallback',
    is_sensitive: true,
    is_editable: true
  },
  {
    config_key: 'ai.groq_api_key',
    config_value: '',
    value_type: 'string',
    category: 'AI_CONFIG',
    description: 'Groq single-key API key fallback',
    is_sensitive: true,
    is_editable: true
  },
  {
    config_key: 'ai.groq_rate_limit_rpm',
    config_value: '30',
    value_type: 'number',
    category: 'AI_CONFIG',
    description: 'Groq API rate limit (requests per minute)',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // INVENTORY (5 configs) - Quản lý kho
  // ============================================================================
  {
    config_key: 'inventory.low_stock_threshold',
    config_value: '10',
    value_type: 'number',
    category: 'INVENTORY',
    description: 'Ngưỡng cảnh báo tồn kho thấp (số lượng)',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'inventory.fifo_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'INVENTORY',
    description: 'Bật/tắt FIFO method',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'inventory.auto_reorder_enabled',
    config_value: 'false',
    value_type: 'boolean',
    category: 'INVENTORY',
    description: 'Bật/tắt tự động đặt hàng lại',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'inventory.reorder_point_multiplier',
    config_value: '1.5',
    value_type: 'number',
    category: 'INVENTORY',
    description: 'Hệ số nhân cho reorder point',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'inventory.max_stock_level',
    config_value: '10000',
    value_type: 'number',
    category: 'INVENTORY',
    description: 'Mức tồn kho tối đa',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // CLOSING (5 configs) - Khóa sổ
  // ============================================================================
  {
    config_key: 'closing.lock_days',
    config_value: '30',
    value_type: 'number',
    category: 'CLOSING',
    description: 'Số ngày khóa sổ tự động sau khi kết thúc kỳ',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'closing.auto_close_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'CLOSING',
    description: 'Bật/tắt khóa sổ tự động',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'closing.require_approval',
    config_value: 'true',
    value_type: 'boolean',
    category: 'CLOSING',
    description: 'Yêu cầu phê duyệt trước khi khóa sổ',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'closing.voucher_type',
    config_value: 'CLOSING',
    value_type: 'string',
    category: 'CLOSING',
    description: 'Loại chứng từ khóa sổ',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'closing.default_tax_rate',
    config_value: '20',
    value_type: 'number',
    category: 'CLOSING',
    description: 'Thuế suất mặc định cho khóa sổ (%)',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // VOUCHER (5 configs) - Chứng từ
  // ============================================================================
  {
    config_key: 'voucher.auto_numbering',
    config_value: 'true',
    value_type: 'boolean',
    category: 'VOUCHER',
    description: 'Bật/tắt đánh số chứng từ tự động',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'voucher.require_approval_threshold',
    config_value: '50000000',
    value_type: 'number',
    category: 'VOUCHER',
    description: 'Ngưỡng cần phê duyệt chứng từ (VND) - 50 triệu',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'voucher.max_items_per_voucher',
    config_value: '50',
    value_type: 'number',
    category: 'VOUCHER',
    description: 'Số dòng tối đa trên 1 chứng từ',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'voucher.allow_edit_posted',
    config_value: 'false',
    value_type: 'boolean',
    category: 'VOUCHER',
    description: 'Cho phép sửa chứng từ đã đăng',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'voucher.default_currency',
    config_value: 'VND',
    value_type: 'string',
    category: 'VOUCHER',
    description: 'Tiền tệ mặc định',
    is_sensitive: false,
    is_editable: true
  },

  // ============================================================================
  // NOTIFICATION (5 configs) - Thông báo
  // ============================================================================
  {
    config_key: 'notification.email_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'NOTIFICATION',
    description: 'Bật/tắt thông báo email',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'notification.sms_enabled',
    config_value: 'false',
    value_type: 'boolean',
    category: 'NOTIFICATION',
    description: 'Bật/tắt thông báo SMS',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'notification.push_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'NOTIFICATION',
    description: 'Bật/tắt push notifications',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'notification.default_limit',
    config_value: '20',
    value_type: 'number',
    category: 'NOTIFICATION',
    description: 'Số thông báo hiển thị mặc định',
    is_sensitive: false,
    is_editable: true
  },
  {
    config_key: 'notification.retention_days',
    config_value: '90',
    value_type: 'number',
    category: 'NOTIFICATION',
    description: 'Số ngày lưu trữ thông báo',
    is_sensitive: false,
    is_editable: true
  }
];

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

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

// Redis client for cache
let redisClient = null;

async function connectRedis() {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️ Redis not available, continuing without cache:', err.message);
    redisClient = null;
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function createIndexes() {
  console.log('\n📊 Bước 1: Tạo indexes cho system_configs table...');

  const indexes = [
    {
      name: 'idx_system_configs_category',
      sql: `CREATE INDEX IF NOT EXISTS idx_system_configs_category 
            ON system_configs(category) 
            WHERE deleted_at IS NULL`
    },
    {
      name: 'idx_system_configs_key',
      sql: `CREATE INDEX IF NOT EXISTS idx_system_configs_key 
            ON system_configs(config_key) 
            WHERE deleted_at IS NULL`
    },
    {
      name: 'idx_system_configs_company',
      sql: `CREATE INDEX IF NOT EXISTS idx_system_configs_company 
            ON system_configs(company_id) 
            WHERE company_id IS NOT NULL AND deleted_at IS NULL`
    },
    {
      name: 'idx_system_configs_composite',
      sql: `CREATE INDEX IF NOT EXISTS idx_system_configs_composite 
            ON system_configs(company_id, category, config_key) 
            WHERE deleted_at IS NULL`
    }
  ];

  for (const index of indexes) {
    try {
      await pool.query(index.sql);
      console.log(`  ✅ Created index: ${index.name}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭️  Index already exists: ${index.name}`);
      } else {
        console.error(`  ❌ Error creating index ${index.name}:`, err.message);
        throw err;
      }
    }
  }
}

async function seedConfigs() {
  console.log('\n🌱 Bước 2: Seed config values vào database...');

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const config of CONFIG_SEEDS) {
    try {
      const result = await pool.query(`
        INSERT INTO system_configs (
          config_key,
          config_value,
          value_type,
          category,
          description,
          is_sensitive,
          is_editable,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (config_key) 
        DO UPDATE SET
          config_value = EXCLUDED.config_value,
          value_type = EXCLUDED.value_type,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          is_sensitive = EXCLUDED.is_sensitive,
          is_editable = EXCLUDED.is_editable,
          updated_at = NOW()
        RETURNING id, config_key, config_value
      `, [
        config.config_key,
        config.config_value,
        config.value_type,
        config.category,
        config.description,
        config.is_sensitive,
        config.is_editable
      ]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`  ✅ ${row.config_key} = ${row.config_value}`);
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  ❌ Error seeding ${config.config_key}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Seed Summary:`);
  console.log(`  ✅ Inserted/Updated: ${inserted}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
}

async function createHelperFunctions() {
  console.log('\n🔧 Bước 3: Tạo helper functions...');

  // Function to get system config with company-specific fallback
  await pool.query(`
    CREATE OR REPLACE FUNCTION get_system_config(
      p_config_key VARCHAR(255),
      p_company_id INTEGER DEFAULT NULL
    ) RETURNS VARCHAR(255) AS $$
    DECLARE
      v_config_value VARCHAR(255);
    BEGIN
      -- Try company-specific config first
      IF p_company_id IS NOT NULL THEN
        SELECT config_value INTO v_config_value
        FROM system_configs
        WHERE config_key = p_config_key
          AND company_id = p_company_id
          AND is_active = true
          AND deleted_at IS NULL
        LIMIT 1;

        IF v_config_value IS NOT NULL THEN
          RETURN v_config_value;
        END IF;
      END IF;

      -- Fallback to global config
      SELECT config_value INTO v_config_value
      FROM system_configs
      WHERE config_key = p_config_key
        AND company_id IS NULL
        AND is_active = true
        AND deleted_at IS NULL
      LIMIT 1;

      RETURN v_config_value;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
  console.log('  ✅ Created get_system_config() function');

  // Function to get system config with type casting
  await pool.query(`
    CREATE OR REPLACE FUNCTION get_system_config_typed(
      p_config_key VARCHAR(255),
      p_value_type VARCHAR(50),
      p_company_id INTEGER DEFAULT NULL
    ) RETURNS TEXT AS $$
    DECLARE
      v_config_value TEXT;
    BEGIN
      v_config_value := get_system_config(p_config_key, p_company_id);

      IF v_config_value IS NULL THEN
        RETURN NULL;
      END IF;

      RETURN v_config_value::TEXT;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
  console.log('  ✅ Created get_system_config_typed() function');

  // Function to get all configs for a company
  await pool.query(`
    CREATE OR REPLACE FUNCTION get_company_system_configs(
      p_company_id INTEGER DEFAULT NULL
    ) RETURNS TABLE (
      config_key VARCHAR(255),
      config_value VARCHAR(255),
      value_type VARCHAR(50),
      category VARCHAR(100),
      description TEXT,
      is_sensitive BOOLEAN,
      is_editable BOOLEAN
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        sc.config_key,
        sc.config_value,
        sc.value_type,
        sc.category,
        sc.description,
        sc.is_sensitive,
        sc.is_editable
      FROM system_configs sc
      WHERE 
        (p_company_id IS NULL AND sc.company_id IS NULL)
        OR (p_company_id IS NOT NULL AND sc.company_id = p_company_id)
        AND sc.is_active = true
        AND sc.deleted_at IS NULL
      ORDER BY sc.category, sc.config_key;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
  console.log('  ✅ Created get_company_system_configs() function');
}

async function createCacheWarmingFunction() {
  console.log('\n🔥 Bước 4: Tạo cache warming function...');

  await pool.query(`
    CREATE OR REPLACE FUNCTION warm_system_config_cache(
      p_company_id INTEGER DEFAULT NULL
    ) RETURNS VOID AS $$
    DECLARE
      v_config RECORD;
    BEGIN
      FOR v_config IN 
        SELECT config_key, config_value, value_type
        FROM system_configs
        WHERE 
          (p_company_id IS NULL AND company_id IS NULL)
          OR (p_company_id IS NOT NULL AND company_id = p_company_id)
          AND is_active = true
          AND deleted_at IS NULL
      LOOP
        -- Cache key format: system_config:{company_id}:{config_key}
        -- This function is called from application code, not SQL
        NULL;
      END LOOP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('  ✅ Created warm_system_config_cache() function');
}

async function verifyMigration() {
  console.log('\n✅ Bước 5: Verify migration...');

  // Count total configs
  const countResult = await pool.query(`
    SELECT COUNT(*) as total
    FROM system_configs
    WHERE deleted_at IS NULL
  `);

  console.log(`  📊 Total configs in database: ${countResult.rows[0].total}`);

  // Count by category
  const categoryResult = await pool.query(`
    SELECT category, COUNT(*) as count
    FROM system_configs
    WHERE deleted_at IS NULL
    GROUP BY category
    ORDER BY category
  `);

  console.log('\n  📋 Configs by category:');
  categoryResult.rows.forEach(row => {
    console.log(`    ${row.category}: ${row.count} configs`);
  });

  // Verify helper functions exist
  const functionResult = await pool.query(`
    SELECT proname
    FROM pg_proc
    WHERE proname IN (
      'get_system_config',
      'get_system_config_typed',
      'get_company_system_configs',
      'warm_system_config_cache'
    )
  `);

  console.log('\n  🔧 Helper functions created:');
  functionResult.rows.forEach(row => {
    console.log(`    ✅ ${row.proname}()`);
  });
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function migrate() {
  console.log('🚀 Phase 5: Configuration Management System Migration\n');
  console.log('=' .repeat(70));

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Connect to Redis
    await connectRedis();

    // Run migration steps
    await createIndexes();
    await seedConfigs();
    await createHelperFunctions();
    await createCacheWarmingFunction();
    await verifyMigration();

    console.log('\n' + '='.repeat(70));
    console.log('✅ Phase 5 migration completed successfully!');
    console.log('='.repeat(70));

    console.log('\n📝 Next steps:');
    console.log('  1. Restart backend services to load new configs');
    console.log('  2. Test CRUD API endpoints');
    console.log('  3. Access frontend admin page at /admin/system-configs');
    console.log('  4. Update backend services to use dynamic configs');

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    throw err;
  } finally {
    await pool.end();
    if (redisClient) {
      await redisClient.quit();
    }
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});