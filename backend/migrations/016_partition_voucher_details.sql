-- ====================================================================
-- PARTITIONING VOUCHER_DETAILS THEO THÁNG
-- ====================================================================
-- Áp dụng Declarative Partitioning để tối ưu hiệu năng
-- Bảng voucher_details sẽ được chia thành các partition theo tháng

-- Tạo bảng cha (nếu chưa có)
-- Lưu ý: PostgreSQL yêu cầu tạo lại bảng để partitioning
-- Do đó chúng ta tạo partition cho dữ liệu mới

-- Tạo default partition cho dữ liệu cũ (không thuộc tháng nào)
CREATE TABLE IF NOT EXISTS voucher_details_default (
    CHECK (voucher_id IS NULL)
) INHERITS (voucher_details);

-- Tạo partition cho tháng 1-2026
CREATE TABLE IF NOT EXISTS voucher_details_2026_01 (
    CHECK (voucher_id IN (
        SELECT id FROM vouchers WHERE EXTRACT(YEAR FROM voucher_date) = 2026 AND EXTRACT(MONTH FROM voucher_date) = 1
    ))
) INHERITS (voucher_details);

-- Tạo partition cho tháng 2-2026
CREATE TABLE IF NOT EXISTS voucher_details_2026_02 (
    CHECK (voucher_id IN (
        SELECT id FROM vouchers WHERE EXTRACT(YEAR FROM voucher_date) = 2026 AND EXTRACT(MONTH FROM voucher_date) = 2
    ))
) INHERITS (voucher_details);

-- Tạo index cho từng partition
CREATE INDEX IF NOT EXISTS idx_voucher_details_2026_01_voucher ON voucher_details_2026_01(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_details_2026_01_account ON voucher_details_2026_01(account_code);
CREATE INDEX IF NOT EXISTS idx_voucher_details_2026_02_voucher ON voucher_details_2026_02(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_details_2026_02_account ON voucher_details_2026_02(account_code);

-- Tạo function tự động tạo partition mới
CREATE OR REPLACE FUNCTION create_voucher_details_partition(year INTEGER, month INTEGER)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := format('voucher_details_%s_%s', year, to_char(month, 'FM00'));
    
    -- Kiểm tra partition đã tồn tại chưa
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        start_date := make_date(year, month, 1);
        end_date := start_date + interval '1 month';
        
        EXECUTE format($sql$
            CREATE TABLE %I (
                CHECK (voucher_id IN (
                    SELECT id FROM vouchers 
                    WHERE voucher_date >= DATE '%s' AND voucher_date < DATE '%s'
                ))
            ) INHERITS (voucher_details)
        $sql$, partition_name, start_date, end_date);
        
        -- Tạo index cho partition mới
        EXECUTE format('CREATE INDEX idx_%s_voucher ON %I(voucher_id)', partition_name, partition_name);
        EXECUTE format('CREATE INDEX idx_%s_account ON %I(account_code)', partition_name, partition_name);
        
        RAISE NOTICE 'Created partition %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Tạo constraint trigger để tự động chèn vào partition đúng
-- Lưu ý: Cách này dùng cho PostgreSQL < 10, với PG >= 10 nên dùng declarative partitioning