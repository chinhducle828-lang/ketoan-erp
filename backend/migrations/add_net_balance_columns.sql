-- Migration: Add net_balance and balance_type columns to monthly_balances
-- Version: 2025-01-11
-- Description: Support for NET balance display in financial reports

-- Add new columns
ALTER TABLE monthly_balances 
  ADD COLUMN IF NOT EXISTS net_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_type VARCHAR(10) NOT NULL DEFAULT 'DEBIT' CHECK (balance_type IN ('DEBIT', 'CREDIT'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_monthly_balances_net_balance 
  ON monthly_balances(company_id, year, month, balance_type);

-- Create PostgreSQL function to determine account nature
CREATE OR REPLACE FUNCTION get_account_nature(account_code VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  -- Check exceptions first (exact match)
  IF account_code IN ('131', '331', '138', '338') THEN
    RETURN 'BOTH';
  END IF;
  
  -- Check parent codes for sub-accounts
  IF LEFT(account_code, 3) IN ('131', '331', '138', '338') THEN
    RETURN 'BOTH';
  END IF;
  
  -- Special cases
  IF account_code IN ('214', '229') OR LEFT(account_code, 3) IN ('214', '229') THEN
    RETURN 'CREDIT';
  END IF;
  
  -- Prefix rules
  IF LEFT(account_code, 1) IN ('1', '2', '6', '8', '9') THEN
    RETURN 'DEBIT';
  ELSIF LEFT(account_code, 1) IN ('3', '4', '5', '7') THEN
    RETURN 'CREDIT';
  END IF;
  
  -- Default
  RETURN 'DEBIT';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'monthly_balances'
  AND column_name IN ('net_balance', 'balance_type')
ORDER BY column_name;

-- Verify function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_account_nature';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added columns: net_balance, balance_type';
  RAISE NOTICE 'Created function: get_account_nature()';
  RAISE NOTICE 'Created index: idx_monthly_balances_net_balance';
END $$;