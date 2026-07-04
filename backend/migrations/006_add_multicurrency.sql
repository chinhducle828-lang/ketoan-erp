-- Multi-currency support
ALTER TABLE voucher_details 
  ADD COLUMN IF NOT EXISTS amount_origin NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS currency_origin VARCHAR(10) DEFAULT 'VND';
CREATE INDEX IF NOT EXISTS idx_details_currency 
ON voucher_details(currency_origin, voucher_id) 
WHERE currency_origin != 'VND';
COMMENT ON COLUMN voucher_details.amount_origin IS 'Số tiền nguyên tệ (USD, EUR...)';
COMMENT ON COLUMN voucher_details.currency_origin IS 'Loại tiền nguyên tệ';
