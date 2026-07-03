ALTER TABLE opening_balances
ADD COLUMN partner_id INT REFERENCES partners(id) ON DELETE SET NULL;

-- Cập nhật constraint để đảm bảo tính duy nhất cho mỗi đối tác
ALTER TABLE opening_balances
DROP CONSTRAINT IF EXISTS unique_opening_balance,
ADD CONSTRAINT unique_opening_balance UNIQUE (company_id, account_code, fiscal_year, partner_id);
