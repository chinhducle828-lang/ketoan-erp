-- ====================================================================
-- MATERIALIZED VIEWS CHO DASHBOARD - CQRS PATTERN
-- ====================================================================
-- Tối ưu truy vấn OLAP, giảm tải PostgreSQL OLTP

-- 1. Trial Balance Materialized View
-- Tổng hợp số dư tài khoản theo công ty và thời gian
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trial_balance AS
SELECT 
    v.company_id,
    EXTRACT(YEAR FROM v.voucher_date) as year,
    EXTRACT(MONTH FROM v.voucher_date) as month,
    vd.account_code,
    SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
    SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit,
    COUNT(DISTINCT v.id) as voucher_count,
    MAX(v.created_at) as last_updated
FROM vouchers v
JOIN voucher_details vd ON v.id = vd.voucher_id
WHERE v.is_posted = TRUE
GROUP BY v.company_id, year, month, vd.account_code;

CREATE INDEX IF NOT EXISTS idx_mv_trial_balance_company ON mv_trial_balance(company_id);
CREATE INDEX IF NOT EXISTS idx_mv_trial_balance_year_month ON mv_trial_balance(year, month);
CREATE INDEX IF NOT EXISTS idx_mv_trial_balance_account ON mv_trial_balance(account_code);

-- 2. Cashflow Summary Materialized View
-- Tổng hợp dòng tiền theo tài khoản ngân hàng
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cashflow_summary AS
SELECT 
    v.company_id,
    EXTRACT(YEAR FROM v.voucher_date) as year,
    EXTRACT(MONTH FROM v.voucher_date) as month,
    v.currency,
    SUM(CASE WHEN vd.account_code LIKE '111%' OR vd.account_code LIKE '112%' THEN 
        CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE -vd.amount END
    ELSE 0 END) as net_cash_flow,
    COUNT(DISTINCT v.id) as transaction_count
FROM vouchers v
JOIN voucher_details vd ON v.id = vd.voucher_id
WHERE v.is_posted = TRUE
GROUP BY v.company_id, year, month, v.currency;

CREATE INDEX IF NOT EXISTS idx_mv_cashflow_company ON mv_cashflow_summary(company_id);
CREATE INDEX IF NOT EXISTS idx_mv_cashflow_year_month ON mv_cashflow_summary(year, month);

-- 3. Partner Aging Materialized View
-- Độ tuổi công nợ đối tác (theo mô hình Markov)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_partner_aging AS
SELECT 
    v.company_id,
    vd.partner_id,
    p.partner_name,
    p.partner_code,
    SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
    SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit,
    -- Phân loại độ tuổi công nợ
    CASE 
        WHEN MAX(v.voucher_date) >= CURRENT_DATE - INTERVAL '30 days' THEN 'current'
        WHEN MAX(v.voucher_date) >= CURRENT_DATE - INTERVAL '60 days' THEN 'over_30'
        WHEN MAX(v.voucher_date) >= CURRENT_DATE - INTERVAL '90 days' THEN 'over_60'
        WHEN MAX(v.voucher_date) >= CURRENT_DATE - INTERVAL '180 days' THEN 'over_90'
        ELSE 'bad_debt'
    END as aging_category
FROM vouchers v
JOIN voucher_details vd ON v.id = vd.voucher_id
LEFT JOIN partners p ON vd.partner_id = p.id
WHERE v.is_posted = TRUE AND vd.partner_id IS NOT NULL
GROUP BY v.company_id, vd.partner_id, p.partner_name, p.partner_code;

CREATE INDEX IF NOT EXISTS idx_mv_aging_company ON mv_partner_aging(company_id);
CREATE INDEX IF NOT EXISTS idx_mv_aging_partner ON mv_partner_aging(partner_id);
CREATE INDEX IF NOT EXISTS idx_mv_aging_category ON mv_partner_aging(aging_category);

-- 4. Function refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cashflow_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_partner_aging;
    RAISE NOTICE 'Materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- 5. RFM Analysis Materialized View (cho AI CRM)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rfm_analysis AS
SELECT 
    v.company_id,
    vd.partner_id,
    p.partner_name,
    p.partner_code,
    -- Recency: ngày cuối cùng có giao dịch
    MAX(v.voucher_date) as last_transaction_date,
    -- Frequency: số lần giao dịch
    COUNT(DISTINCT v.id) as transaction_count,
    -- Monetary: tổng giá trị
    SUM(vd.amount) as total_amount
FROM vouchers v
JOIN voucher_details vd ON v.id = vd.voucher_id
LEFT JOIN partners p ON vd.partner_id = p.id
WHERE v.is_posted = TRUE AND vd.partner_id IS NOT NULL
GROUP BY v.company_id, vd.partner_id, p.partner_name, p.partner_code;

CREATE INDEX IF NOT EXISTS idx_mv_rfm_company ON mv_rfm_analysis(company_id);
CREATE INDEX IF NOT EXISTS idx_mv_rfm_partner ON mv_rfm_analysis(partner_id);