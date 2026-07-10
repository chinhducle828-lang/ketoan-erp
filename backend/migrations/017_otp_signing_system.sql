-- MIGRATION: OTP SIGNING SYSTEM FOR SALES DOCUMENTS
-- ====================================================================
-- Tuân thủ Luật 108/2025/QH15 (audit trail bất biến, hash OTP, multi-tenant isolation)

-- 1. USERS CONTACT FIELDS
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_token TEXT;

-- 2. VOUCHERS SIGNING FIELDS
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sign_status VARCHAR(20) DEFAULT 'unsigned';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS signed_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sign_channel VARCHAR(20) DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sign_otp_hash TEXT DEFAULT NULL;

-- 3. E-INVOICES SIGNING FIELDS
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS sign_status VARCHAR(20) DEFAULT 'unsigned';
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS signed_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS sign_otp_hash TEXT DEFAULT NULL;

-- 4. OTP SIGNATURES TABLE (Audit trail bất biến)
CREATE TABLE IF NOT EXISTS otp_signatures (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id VARCHAR(50) NOT NULL,
  document_type VARCHAR(20) NOT NULL, -- 'voucher' or 'e-invoice'
  otp_hash TEXT NOT NULL, -- SHA-256 hash of OTP
  company_id INT NOT NULL, -- Multi-tenant isolation
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP DEFAULT NULL,
  sign_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'signed', 'cancelled'
  sign_channel VARCHAR(20) DEFAULT NULL -- 'PUSH', 'SMS', 'EMAIL'
);

-- 5. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_document ON otp_signatures(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_otp_company ON otp_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_signatures(expires_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_sign_status ON vouchers(sign_status);
CREATE INDEX IF NOT EXISTS idx_vouchers_signed_by ON vouchers(signed_by);
CREATE INDEX IF NOT EXISTS idx_e_invoices_sign_status ON e_invoices(sign_status);
