-- ====================================================================
-- BẢNG AI HITL LOGS - GHI LẠI PHẢN HỒI HUMAN-IN-THE-LOOP
-- ====================================================================
-- Dùng cho RLHF (Reinforcement Learning from Human Feedback)
-- Thu thập dữ liệu sửa lỗi để huấn luyện lại mô hình AI

CREATE TABLE IF NOT EXISTS ai_hitl_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    voucher_id BIGINT REFERENCES vouchers(id) ON DELETE CASCADE,
    ai_confidence_score DECIMAL(5,2) NOT NULL CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
    original_ai_proposal JSONB NOT NULL,       -- Payload định khoản do AI sinh ra
    final_human_approved JSONB NOT NULL,         -- Payload định khoản sau khi con người sửa
    is_modified BOOLEAN DEFAULT FALSE,           -- Con người có sửa đổi không?
    modified_fields TEXT[],                      -- Các trường bị sửa
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, -- Người thực hiện duyệt
    ai_model_version VARCHAR(50) DEFAULT 'v1.0', -- Phiên bản mô hình AI
    processing_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Index để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_tenant ON ai_hitl_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_voucher ON ai_hitl_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_user ON ai_hitl_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_confidence ON ai_hitl_logs(ai_confidence_score);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_modified ON ai_hitl_logs(is_modified) WHERE is_modified = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_status ON ai_hitl_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_created ON ai_hitl_logs(created_at DESC);

-- Thêm cột hitl_status vào bảng vouchers (nếu chưa có)
ALTER TABLE vouchers 
  ADD COLUMN IF NOT EXISTS hitl_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,2) DEFAULT NULL;

-- Comment giải thích cách tính confidence score
-- Confidence Score Gates (theo txt2):
-- - AUTO_POSTED: confidence >= 95% AND amount < 5,000,000 VND
-- - HUMAN_REVIEW: 80% <= confidence < 95% OR 5,000,000 <= amount < 50,000,000 VND
-- - EXPERT_AUDIT: confidence < 80% OR amount >= 50,000,000 VND