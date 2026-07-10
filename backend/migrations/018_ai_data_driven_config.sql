-- AI Data-Driven Configuration Tables
-- This migration creates tables for dynamic AI configuration without hard-coding

-- ==================== AI DEPARTMENTS ====================
CREATE TABLE IF NOT EXISTS ai_departments (
  id SERIAL PRIMARY KEY,
  department_code VARCHAR(50) UNIQUE NOT NULL,
  department_name VARCHAR(200) NOT NULL,
  keywords JSONB DEFAULT '[]'::jsonb,
  account_codes JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed departments
INSERT INTO ai_departments (department_code, department_name, keywords, account_codes, description) VALUES
('finance', 'Phòng Tài chính - Kế toán', 
 '["tài chính", "kế toán", "ngân quỹ", "thuế", "hạch toán", "chứng từ", "sổ sách"]',
 '["111", "112", "331", "333", "156", "511", "632", "811"]',
 'Xử lý các nghiệp vụ tài chính, kế toán, ngân quỹ, thuế'),
('sales', 'Phòng Bán hàng',
 '["bán hàng", "khách hàng", "hóa đơn bán", "xuất kho bán", "đơn hàng", "hợp đồng bán"]',
 '["131", "511", "333", "1561"]',
 'Quản lý bán hàng, khách hàng, công nợ phải thu'),
('warehouse', 'Phòng Kho vận',
 '["nhập kho", "xuất kho", "vật tư", "hàng hóa", "tồn kho", "kiểm kê", "phiếu nhập", "phiếu xuất"]',
 '["156", "1561", "211", "121", "1562"]',
 'Quản lý kho, nhập/xuất kho, tồn kho'),
('hr', 'Phòng Nhân sự',
 '["lương", "BHXH", "nhân viên", "thu nhập", "tuyển dụng", "bảo hiểm"]',
 '["334", "335", "622", "623"]',
 'Quản lý lương, BHXH, nhân sự'),
('admin', 'Phòng Quản trị',
 '["hệ thống", "cấu hình", "quản trị", "pháp nhân", "chi nhánh"]',
 '["611", "632", "811"]',
 'Quản trị hệ thống, cấu hình pháp nhân')
ON CONFLICT (department_code) DO NOTHING;

-- ==================== AI WORKFLOW MATRIX ====================
CREATE TABLE IF NOT EXISTS ai_workflow_matrix (
  id SERIAL PRIMARY KEY,
  workflow_code VARCHAR(50) UNIQUE NOT NULL,
  workflow_name VARCHAR(200) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed workflows
INSERT INTO ai_workflow_matrix (workflow_code, workflow_name, description, steps, conditions) VALUES
('ocr_invoice', 'OCR Invoice Processing', 
 'Xử lý hóa đơn GTGT từ ảnh',
 '[
   {"step": 1, "module": "ocr", "action": "extract", "next": 2, "name": "OCR Extraction"},
   {"step": 2, "module": "classifier", "action": "classify_department", "next": 3, "name": "Department Classification"},
   {"step": 3, "module": "validator", "action": "validate", "next": 4, "name": "Validation"},
   {"step": 4, "module": "suggestions", "action": "suggest_accounts", "next": 5, "name": "Smart Suggestions"},
   {"step": 5, "type": "human", "action": "review", "next": 6, "name": "Human Review", "hitl": true, "timeout": 86400},
   {"step": 6, "module": "database", "action": "save", "next": null, "name": "Save to Database"}
 ]'::jsonb,
 '{
   "ocr.confidence > 95": "skip_human_review",
   "ocr.confidence < 80": "require_manager"
 }'::jsonb),
('batch_ocr', 'Batch OCR Processing',
 'Xử lý hàng loạt hóa đơn',
 '[
   {"step": 1, "module": "batch", "action": "upload", "next": 2, "name": "Upload Files"},
   {"step": 2, "module": "ocr", "action": "process_batch", "next": 3, "name": "Batch OCR"},
   {"step": 3, "module": "aggregator", "action": "summarize", "next": 4, "name": "Aggregate Results"},
   {"step": 4, "type": "human", "action": "review_batch", "next": 5, "name": "Batch Review", "hitl": true, "timeout": 172800},
   {"step": 5, "module": "database", "action": "batch_save", "next": null, "name": "Batch Save"}
 ]'::jsonb,
 null),
('voucher_workflow', 'Voucher Processing Workflow',
 'Quy trình xử lý chứng từ',
 '[
   {"step": 1, "module": "validator", "action": "validate_voucher", "next": 2, "name": "Validate Voucher"},
   {"step": 2, "module": "classifier", "action": "classify_department", "next": 3, "name": "Classify Department"},
   {"step": 3, "module": "suggestions", "action": "suggest_entries", "next": 4, "name": "Suggest Entries"},
   {"step": 4, "type": "human", "action": "review", "next": 5, "name": "Review", "hitl": true},
   {"step": 5, "module": "workflow", "action": "post", "next": null, "name": "Post Voucher"}
 ]'::jsonb,
 null)
ON CONFLICT (workflow_code) DO NOTHING;

-- ==================== AI SUGGESTION RULES ====================
CREATE TABLE IF NOT EXISTS ai_suggestion_rules (
  id SERIAL PRIMARY KEY,
  rule_code VARCHAR(50) UNIQUE NOT NULL,
  rule_name VARCHAR(200) NOT NULL,
  trigger_keywords JSONB DEFAULT '[]'::jsonb,
  trigger_accounts JSONB DEFAULT '[]'::jsonb,
  suggested_accounts JSONB DEFAULT '[]'::jsonb,
  suggested_entries JSONB DEFAULT '[]'::jsonb,
  priority INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed suggestion rules
INSERT INTO ai_suggestion_rules (rule_code, rule_name, trigger_keywords, trigger_accounts, suggested_accounts, suggested_entries, priority) VALUES
('purchase_equipment', 'Mua thiết bị văn phòng',
 '["mua", "thiết bị", "máy in", "máy tính", "bàn ghế", "laptop", "màn hình"]'::jsonb,
 '["156"]'::jsonb,
 '[{"code": "156", "name": "Mua hàng, vật tư", "confidence": 95}]'::jsonb,
 '[{"account": "156", "type": "DR", "description": "Mua thiết bị văn phòng"}, {"account": "331", "type": "CR", "description": "Phải trả nhà cung cấp"}]'::jsonb,
 100),
('salary_payment', 'Trả lương nhân viên',
 '["trả lương", "lương", "thu nhập", "công lương"]'::jsonb,
 '["334", "622"]'::jsonb,
 '[{"code": "334", "name": "Phải trả người lao động", "confidence": 98}]'::jsonb,
 '[{"account": "334", "type": "DR", "description": "Trả lương tháng"}, {"account": "111", "type": "CR", "description": "Tiền mặt"}]'::jsonb,
 100),
('rent_payment', 'Trả tiền thuê nhà',
 '["trả tiền nhà", "tiền thuê", "thuê văn phòng", "thuê kho"]'::jsonb,
 '["611", "333"]'::jsonb,
 '[{"code": "611", "name": "Chi phí quản lý doanh nghiệp", "confidence": 95}]'::jsonb,
 '[{"account": "611", "type": "DR", "description": "Tiền thuê nhà tháng"}, {"account": "111", "type": "CR", "description": "Tiền mặt"}]'::jsonb,
 90),
('sales_invoice', 'Hóa đơn bán hàng',
 '["bán hàng", "xuất kho bán", "hóa đơn bán", "khách hàng"]'::jsonb,
 '["131", "511"]'::jsonb,
 '[{"code": "131", "name": "Phải thu khách hàng", "confidence": 95}]'::jsonb,
 '[{"account": "131", "type": "DR", "description": "Bán hàng"}, {"account": "511", "type": "CR", "description": "Doanh thu bán hàng"}]'::jsonb,
 90),
('utility_payment', 'Thanh toán tiền điện nước',
 '["tiền điện", "tiền nước", "tiền internet", "điện nước"]'::jsonb,
 '["611", "112"]'::jsonb,
 '[{"code": "611", "name": "Chi phí quản lý doanh nghiệp", "confidence": 92}]'::jsonb,
 '[{"account": "611", "type": "DR", "description": "Tiền điện nước tháng"}, {"account": "111", "type": "CR", "description": "Tiền mặt"}]'::jsonb,
 80)
ON CONFLICT (rule_code) DO NOTHING;

-- ==================== AI BATCH CONFIGS ====================
CREATE TABLE IF NOT EXISTS ai_batch_configs (
  id SERIAL PRIMARY KEY,
  config_code VARCHAR(50) UNIQUE NOT NULL,
  config_name VARCHAR(200) NOT NULL,
  max_batch_size INTEGER DEFAULT 100,
  parallel_workers INTEGER DEFAULT 5,
  confidence_threshold INTEGER DEFAULT 90,
  auto_approve_threshold INTEGER DEFAULT 95,
  hitl_required BOOLEAN DEFAULT true,
  timeout_minutes INTEGER DEFAULT 60,
  notification_channels JSONB DEFAULT '["email"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed batch configs
INSERT INTO ai_batch_configs (config_code, config_name, max_batch_size, parallel_workers, confidence_threshold, auto_approve_threshold) VALUES
('invoice_batch', 'Batch Invoice Processing', 100, 5, 90, 95),
('voucher_batch', 'Batch Voucher Processing', 200, 10, 85, 90),
('document_import', 'Document Import', 500, 10, 80, 90)
ON CONFLICT (config_code) DO NOTHING;

-- ==================== AI HITL QUEUE ====================
CREATE TABLE IF NOT EXISTS ai_hitl_queue (
  id SERIAL PRIMARY KEY,
  workflow_type VARCHAR(50) NOT NULL,
  step VARCHAR(50) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, TIMEOUT
  timeout_at TIMESTAMP NOT NULL,
  escalation_to VARCHAR(50),  -- 'manager', 'admin'
  approved_by INTEGER,
  approved_at TIMESTAMP,
  rejected_by INTEGER,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  corrections JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hitl_queue_company ON ai_hitl_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_status ON ai_hitl_queue(status);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_timeout ON ai_hitl_queue(timeout_at);

-- ==================== AI WORKFLOW HISTORY ====================
CREATE TABLE IF NOT EXISTS ai_workflow_history (
  id SERIAL PRIMARY KEY,
  workflow_id VARCHAR(50) UNIQUE NOT NULL,
  workflow_type VARCHAR(50) NOT NULL,
  company_id VARCHAR(50) NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb,
  final_status VARCHAR(20) NOT NULL,  -- COMPLETED, FAILED, TIMEOUT, REJECTED
  created_by INTEGER,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_company ON ai_workflow_history(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_type ON ai_workflow_history(workflow_type);

-- ==================== AI LEARNING DATA ====================
CREATE TABLE IF NOT EXISTS ai_learning_data (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,  -- 'ocr', 'suggestions', 'classifier'
  input_data JSONB NOT NULL,
  ai_output JSONB NOT NULL,
  user_correction JSONB,
  is_correct BOOLEAN,
  learned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_data_module ON ai_learning_data(module);
CREATE INDEX IF NOT EXISTS idx_learning_data_company ON ai_learning_data(company_id);

-- ==================== TRIGGERS ====================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_ai_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_ai_departments_timestamp ON ai_departments;
CREATE TRIGGER update_ai_departments_timestamp
  BEFORE UPDATE ON ai_departments
  FOR EACH ROW EXECUTE FUNCTION update_ai_timestamp();

DROP TRIGGER IF EXISTS update_ai_workflow_matrix_timestamp ON ai_workflow_matrix;
CREATE TRIGGER update_ai_workflow_matrix_timestamp
  BEFORE UPDATE ON ai_workflow_matrix
  FOR EACH ROW EXECUTE FUNCTION update_ai_timestamp();

DROP TRIGGER IF EXISTS update_ai_suggestion_rules_timestamp ON ai_suggestion_rules;
CREATE TRIGGER update_ai_suggestion_rules_timestamp
  BEFORE UPDATE ON ai_suggestion_rules
  FOR EACH ROW EXECUTE FUNCTION update_ai_timestamp();

DROP TRIGGER IF EXISTS update_ai_batch_configs_timestamp ON ai_batch_configs;
CREATE TRIGGER update_ai_batch_configs_timestamp
  BEFORE UPDATE ON ai_batch_configs
  FOR EACH ROW EXECUTE FUNCTION update_ai_timestamp();

-- ==================== VIEWS ====================

-- View for active departments
CREATE OR REPLACE VIEW vw_ai_departments AS
SELECT 
  id,
  department_code,
  department_name,
  keywords,
  account_codes,
  description,
  is_active,
  created_at,
  updated_at
FROM ai_departments
WHERE is_active = true
ORDER BY department_name;

-- View for active workflows
CREATE OR REPLACE VIEW vw_ai_workflows AS
SELECT 
  id,
  workflow_code,
  workflow_name,
  description,
  steps,
  conditions,
  is_active,
  created_at,
  updated_at
FROM ai_workflow_matrix
WHERE is_active = true
ORDER BY workflow_name;

-- View for suggestion rules with stats
CREATE OR REPLACE VIEW vw_ai_suggestion_rules AS
SELECT 
  id,
  rule_code,
  rule_name,
  trigger_keywords,
  trigger_accounts,
  suggested_accounts,
  suggested_entries,
  priority,
  usage_count,
  success_count,
  CASE 
    WHEN usage_count > 0 THEN ROUND((success_count::numeric / usage_count::numeric) * 100, 2)
    ELSE 0
  END AS success_rate,
  is_active,
  created_at,
  updated_at
FROM ai_suggestion_rules
WHERE is_active = true
ORDER BY priority DESC, success_rate DESC;

-- View for HITL queue
CREATE OR REPLACE VIEW vw_ai_hitl_queue AS
SELECT 
  q.id,
  q.workflow_type,
  q.step,
  q.data,
  q.company_id,
  q.status,
  q.timeout_at,
  q.escalation_to,
  q.approved_by,
  q.approved_at,
  q.rejected_by,
  q.rejected_at,
  q.rejection_reason,
  q.corrections,
  q.created_at,
  CASE 
    WHEN q.timeout_at < NOW() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS queue_status
FROM ai_hitl_queue q
WHERE q.status = 'PENDING'
ORDER BY q.created_at ASC;

-- ==================== FUNCTIONS ====================

-- Function to get department by content
CREATE OR REPLACE FUNCTION fn_get_department_by_content(content_text TEXT)
RETURNS TABLE(department_code VARCHAR, department_name VARCHAR, confidence INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.department_code,
    d.department_name,
    85 as confidence  -- Base confidence, AI will adjust
  FROM ai_departments d
  WHERE d.is_active = true
    AND (
      content_text ILIKE ANY(d.keywords)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(d.account_codes::jsonb) acc
        WHERE content_text ILIKE '%' || acc || '%'
      )
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get suggestions by content
CREATE OR REPLACE FUNCTION fn_get_suggestions_by_content(content_text TEXT)
RETURNS TABLE(
  rule_code VARCHAR,
  rule_name VARCHAR,
  suggested_accounts JSONB,
  suggested_entries JSONB,
  confidence INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.rule_code,
    r.rule_name,
    r.suggested_accounts,
    r.suggested_entries,
    90 as confidence
  FROM ai_suggestion_rules r
  WHERE r.is_active = true
    AND (
      content_text ILIKE ANY(r.trigger_keywords)
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(r.trigger_accounts::jsonb) acc
        WHERE content_text ILIKE '%' || acc || '%'
      )
    )
  ORDER BY r.priority DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- ==================== GRANTS ====================
-- Grant permissions (adjust as needed)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ==================== COMMENTS ====================
COMMENT ON TABLE ai_departments IS 'AI Department classification configuration';
COMMENT ON TABLE ai_workflow_matrix IS 'Data-driven workflow definitions';
COMMENT ON TABLE ai_suggestion_rules IS 'Smart suggestion rules for AI';
COMMENT ON TABLE ai_batch_configs IS 'Batch processing configurations';
COMMENT ON TABLE ai_hitl_queue IS 'Human-in-the-loop review queue';
COMMENT ON TABLE ai_workflow_history IS 'Workflow execution history';
COMMENT ON TABLE ai_learning_data IS 'AI learning data from user corrections';