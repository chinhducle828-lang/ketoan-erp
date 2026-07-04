-- ====================================================================
-- CẤU TRÚC CƠ SỞ DỮ LIỆU HỆ THỐNG KETOAN ERP - THÔNG TƯ 99/2025/TT-BTC
-- QUẢN LÝ ĐA TIỀN TỆ - SỐ LƯỢNG KHO - PHÂN HỆ KHÓA SỔ & ĐỐI TÁC SUB-LEDGER
-- ====================================================================

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    lock_date DATE DEFAULT NULL, -- Ngày khóa sổ kế toán chặn sửa/xóa dữ liệu quá khứ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS lock_date DATE DEFAULT NULL;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'nv', -- admin, ktt, nv
    company_ids INT[] DEFAULT '{}', -- Mảng ID các công ty user có quyền truy cập
    staff_ids INT[] DEFAULT '{}', -- Mảng ID nhân viên phụ trách (chỉ cho KTT)
    manager_id INT REFERENCES users(id) ON DELETE SET NULL, -- Kế toán trưởng quản lý
    must_change_password BOOLEAN DEFAULT FALSE, -- Bắt buộc đổi mật khẩu lần đầu
    is_root_admin BOOLEAN DEFAULT FALSE, -- Chỉ tài khoản root admin mới xem được audit logs
    preferences JSONB DEFAULT '{}', -- Lưu trữ tùy chỉnh giao diện
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_company_ids ON users USING GIN(company_ids);
CREATE INDEX IF NOT EXISTS idx_users_staff_ids ON users USING GIN(staff_ids);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'users' AND c.conname = 'users_role_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;

    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho', 'gd_kinhdoanh'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    partner_code VARCHAR(50) NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_partner_company_code UNIQUE (company_id, partner_code)
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) DEFAULT 'Cái',
    price_sell NUMERIC(15,2) DEFAULT 0,
    opening_quantity NUMERIC(15,4) DEFAULT 0,
    image_url TEXT,
    image_urls JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_item_company_code UNIQUE (company_id, code)
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS price_sell NUMERIC(15,2) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS opening_quantity NUMERIC(15,4) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]';
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100) NOT NULL,
    voucher_date DATE NOT NULL,
    voucher_type VARCHAR(10) NOT NULL, -- PT, PC, NK, XK, DauKy
    description TEXT,
    currency VARCHAR(10) DEFAULT 'VND',
    exchange_rate NUMERIC(15,4) DEFAULT 1.0000,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    is_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP DEFAULT NULL,
    posted_by INT REFERENCES users(id) ON DELETE SET NULL,
    loading_status VARCHAR(20) DEFAULT 'pending_loading',
    truck_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS loading_status VARCHAR(20) DEFAULT 'pending_loading';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS truck_id INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS voucher_details (
    id SERIAL PRIMARY KEY,
    voucher_id INT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    entry_type VARCHAR(2) NOT NULL CHECK (entry_type IN ('DR', 'CR')), -- DR: Nợ, CR: Có
    amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0), -- Số tiền quy đổi nguyên tệ sang VND
    quantity NUMERIC(15,4) DEFAULT 0,                  -- Số lượng quản lý kho
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL, -- Chi tiết công nợ phụ
    item_id INT REFERENCES items(id) ON DELETE SET NULL        -- Chi tiết mã vật tư phụ
);

ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS amount_origin NUMERIC(15,2);
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS currency_origin VARCHAR(10) DEFAULT 'VND';

CREATE TABLE IF NOT EXISTS opening_balances (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    account_code VARCHAR(20) NOT NULL,
    opening_debit NUMERIC(15,2) DEFAULT 0,
    opening_credit NUMERIC(15,2) DEFAULT 0,
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL, -- Hỗ trợ tài khoản lưỡng tính theo đối tác (TK 131, 331)
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_opening_balance UNIQUE (company_id, account_code, fiscal_year, partner_id)
);

-- HỆ THỐNG INDEXES TỐI ƯU HIỆU NĂNG TRUY VẤN VÀ DỒN TÍCH SỐ DƯ
CREATE INDEX IF NOT EXISTS idx_vouchers_date_company ON vouchers(company_id, voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_status ON vouchers(company_id, is_posted, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;
CREATE INDEX IF NOT EXISTS idx_voucher_details_lookup ON voucher_details(voucher_id, account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_opening_balances_lookup ON opening_balances(company_id, fiscal_year, account_code);
CREATE INDEX IF NOT EXISTS idx_partners_company_search ON partners(company_id, partner_code, partner_name);
CREATE TABLE IF NOT EXISTS trucks (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plate_number VARCHAR(20) NOT NULL,
    driver_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_truck_company_plate UNIQUE (company_id, plate_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_truck_id_fk'
  ) THEN
    ALTER TABLE vouchers ADD CONSTRAINT vouchers_truck_id_fk FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_company_search ON items(company_id, code, name);

-- ====================================================================
-- BỔ SUNG BẢNG NHẬT KÝ HỆ THỐNG (AUDIT LOGS) & IP TRACKING
-- ====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,       -- LOGIN, CREATE, UPDATE, DELETE
    entity_type VARCHAR(50) NOT NULL,  -- VOUCHERS, USERS, PARTNERS, COMPANIES
    old_values JSONB DEFAULT NULL,     -- Trạng thái dữ liệu TRƯỚC khi thay đổi
    new_values JSONB DEFAULT NULL,     -- Trạng thái dữ liệu SAU khi thay đổi
    ip_address VARCHAR(45) NOT NULL,   -- Hỗ trợ lưu cả địa chỉ IPv4 và IPv6 đầy đủ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tạo Index tăng tốc truy vấn tìm kiếm lịch sử cho Admin
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs(action, entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ====================================================================
-- BẢNG SESSIONS - QUẢN LÝ PHIÊN LÀM VIỆC (JWT + REFRESH TOKEN)
-- ====================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL, -- Access Token (JWT)
    refresh_token TEXT NOT NULL, -- Refresh Token (đã hash)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    ip_address VARCHAR(45), -- Hỗ trợ IPv4 và IPv6
    device_info TEXT -- User-Agent string
);

-- Index để tăng tốc kiểm tra session khi authenticate
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    order_id INT REFERENCES vouchers(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    recipient_role VARCHAR(20),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, is_read);

-- ====================================================================
-- BỔ SUNG BẢNG WORKFLOW KẾT CHUYỂN, TỔNG HỢP THÁNG VÀ PHIẾU KHO CHI TIẾT
-- ====================================================================

CREATE TABLE IF NOT EXISTS closing_entries (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year INT NOT NULL,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP DEFAULT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT closing_entries_status_check CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_closing_entries_lookup ON closing_entries(company_id, year, month, status);

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

CREATE INDEX IF NOT EXISTS idx_monthly_balances_lookup ON monthly_balances(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_account ON monthly_balances(account_code);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_partner ON monthly_balances(partner_id, account_code) WHERE partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_vouchers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100) NOT NULL,
    voucher_date DATE NOT NULL,
    io_type VARCHAR(10) NOT NULL CHECK (io_type IN ('IMPORT', 'EXPORT')),
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
    description TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inventory_voucher_number UNIQUE (company_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_vouchers_company_date ON inventory_vouchers(company_id, voucher_date DESC);

CREATE TABLE IF NOT EXISTS inventory_voucher_details (
    id SERIAL PRIMARY KEY,
    inventory_voucher_id INT NOT NULL REFERENCES inventory_vouchers(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    debit_account_code VARCHAR(20) NOT NULL,
    credit_account_code VARCHAR(20) NOT NULL,
    quantity NUMERIC(15,4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_voucher_details_master ON inventory_voucher_details(inventory_voucher_id);
CREATE INDEX IF NOT EXISTS idx_inventory_voucher_details_item ON inventory_voucher_details(item_id);

-- ====================================================================
-- INDEX BỔ SUNG CHO HIỆU NĂNG PHÂN HỆ CHỨNG TỪ VÀ ĐA TIỀN TỆ
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_vouchers_company_date ON vouchers(company_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_details_account_entry ON voucher_details(account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_details_voucher_lookup ON voucher_details(voucher_id);
CREATE INDEX IF NOT EXISTS idx_details_partner_account ON voucher_details(partner_id, account_code) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_details_tax_accounts ON voucher_details(account_code) WHERE account_code LIKE '333%';
CREATE INDEX IF NOT EXISTS idx_details_currency ON voucher_details(currency_origin, voucher_id) WHERE currency_origin != 'VND';
