-- Migration: AI Self-Improving Enhancement
-- Thêm cột cho chức năng AI tự sửa chính mình

-- Thêm cột theo dõi số lần tự sửa
ALTER TABLE ai_hitl_logs 
ADD COLUMN IF NOT EXISTS self_fix_attempts INTEGER DEFAULT 0;

-- Thêm cột version model AI đang sử dụng
ALTER TABLE ai_hitl_logs 
ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(20) DEFAULT 'v1.0';

-- Thêm cột lịch sử các version đã thử
ALTER TABLE ai_hitl_logs 
ADD COLUMN IF NOT EXISTS ai_fix_history JSONB DEFAULT '[]'::jsonb;

-- Thêm cột cờ đánh dấu đã tự sửa
ALTER TABLE ai_hitl_logs 
ADD COLUMN IF NOT EXISTS is_self_fixed BOOLEAN DEFAULT FALSE;

-- Thêm cột thời gian tự sửa cuối cùng
ALTER TABLE ai_hitl_logs 
ADD COLUMN IF NOT EXISTS last_self_fix_at TIMESTAMP DEFAULT NULL;

-- Tạo index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_ai_hitl_self_fix 
ON ai_hitl_logs (tenant_id, self_fix_attempts, processing_status);

-- Tạo bảng lưu trữ version model
CREATE TABLE IF NOT EXISTS ai_model_versions (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  accuracy_score NUMERIC(5,2) DEFAULT 0,
  training_data_count INTEGER DEFAULT 0,
  deployed_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tạo index cho model versions
CREATE INDEX IF NOT EXISTS idx_ai_model_active 
ON ai_model_versions (is_active DESC, deployed_at DESC);

-- Tạo bảng circuit breaker - dừng tự sửa khi có vấn đề
CREATE TABLE IF NOT EXISTS ai_circuit_breaker (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  model_name VARCHAR(50) NOT NULL,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP DEFAULT NOW(),
  is_open BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tạo index cho circuit breaker
CREATE INDEX IF NOT EXISTS idx_ai_circuit_tenant 
ON ai_circuit_breaker (tenant_id, model_name);