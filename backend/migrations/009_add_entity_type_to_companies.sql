-- ====================================================================
-- MIGRATION 009: Thêm thông tin pháp nhân doanh nghiệp
-- Hỗ trợ phân nhánh rule thuế theo entity_type + annual_revenue_band
-- ====================================================================

-- Thêm cột entity_type: loại pháp nhân
ALTER TABLE companies ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'company';
COMMENT ON COLUMN companies.entity_type IS 'Loại pháp nhân: company (công ty), household (hộ kinh doanh), cooperative (hợp tác xã), other (khác)';

-- Thêm cột annual_revenue_band: mức doanh thu năm
ALTER TABLE companies ADD COLUMN IF NOT EXISTS annual_revenue_band VARCHAR(20) DEFAULT 'under_1b';
COMMENT ON COLUMN companies.annual_revenue_band IS 'Mức doanh thu năm: under_1b (dưới 1 tỷ), 1b_3b (1-3 tỷ), over_3b (trên 3 tỷ)';

-- Thêm cột is_active (nếu chưa có) - cho middleware waf check
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;