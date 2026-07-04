-- Composite Indexes tối ưu hiệu năng truy vấn
-- Đảm bảo cột exchange_rate tồn tại trước khi tạo index
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,4) DEFAULT 1.0000;

-- Index cho bảng vouchers: company_id + voucher_date
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date 
ON vouchers(company_id, voucher_date DESC) 
INCLUDE (id, voucher_type, exchange_rate);

-- Index cho bảng voucher_details: account_code + entry_type
CREATE INDEX IF NOT EXISTS idx_details_account_entry 
ON voucher_details(account_code, entry_type) 
INCLUDE (voucher_id, amount, partner_id, item_id);

-- Index cho bảng voucher_details: voucher_id
CREATE INDEX IF NOT EXISTS idx_details_voucher_lookup 
ON voucher_details(voucher_id) 
INCLUDE (account_code, entry_type, amount);

-- Index cho tài khoản lưỡng tính: partner_id + account_code
CREATE INDEX IF NOT EXISTS idx_details_partner_account 
ON voucher_details(partner_id, account_code) 
WHERE partner_id IS NOT NULL;

-- Index cho báo cáo thuế: account_code LIKE '333%'
CREATE INDEX IF NOT EXISTS idx_details_tax_accounts 
ON voucher_details(account_code) 
WHERE account_code LIKE '333%';
