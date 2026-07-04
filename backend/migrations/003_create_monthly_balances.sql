-- Bảng chốt số dư theo tháng (tối ưu báo cáo)
CREATE TABLE IF NOT EXISTS monthly_balances (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_code VARCHAR(20) NOT NULL,
  partner_id INTEGER NULL REFERENCES partners(id) ON DELETE SET NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  closing_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_monthly_balances_company_account_partner_month_year
ON monthly_balances(company_id, account_code, COALESCE(partner_id, 0), month, year);

CREATE INDEX IF NOT EXISTS idx_monthly_balances_lookup 
ON monthly_balances(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_account 
ON monthly_balances(account_code);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_partner 
ON monthly_balances(partner_id, account_code) WHERE partner_id IS NOT NULL;
