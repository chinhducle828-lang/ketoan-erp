-- Migration: Voucher status workflow
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_by INT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_status ON vouchers(company_id, is_posted, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;
