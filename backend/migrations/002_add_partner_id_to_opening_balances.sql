DO $$
BEGIN
    -- 1. Chỉ thêm cột partner_id nếu nó CHƯA tồn tại
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'opening_balances' AND column_name = 'partner_id'
    ) THEN
        ALTER TABLE opening_balances
        ADD COLUMN partner_id INT REFERENCES partners(id) ON DELETE SET NULL;
    END IF;

    -- 2. Xóa constraint cũ nếu có và cập nhật lại constraint mới
    ALTER TABLE opening_balances DROP CONSTRAINT IF EXISTS unique_opening_balance;
    
    ALTER TABLE opening_balances
    ADD CONSTRAINT unique_opening_balance UNIQUE (company_id, account_code, fiscal_year, partner_id);
END $$;