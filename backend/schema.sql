-- ====================================================================
-- CẤU TRÚC CƠ SỞ DỮ LIỆU HỆ THỐNG KETOAN ERP - THÔNG TƯ 99/2025/TT-BTC
-- ====================================================================
-- FILE HỢP NHẤT: Bao gồm schema gốc + tất cả migrations (47 files)
-- Tất cả các lệnh đều dùng IF NOT EXISTS để đảm bảo chạy được nhiều lần
-- ====================================================================

-- ====================================================================
-- 1. CORE TABLES
-- ====================================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    entity_type VARCHAR(50) DEFAULT 'company',
    lock_date DATE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'nv',
    company_ids INT[] DEFAULT '{}',
    staff_ids INT[] DEFAULT '{}',
    manager_id INT REFERENCES users(id) ON DELETE SET NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    is_root_admin BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "in_app": true, "quiet_hours_start": null, "quiet_hours_end": null}',
    department VARCHAR(50) DEFAULT 'finance',
    clearance_level INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = 'users' AND c.conname = 'users_role_check') THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho', 'gd_kinhdoanh'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_company_ids ON users USING GIN(company_ids);
CREATE INDEX IF NOT EXISTS idx_users_staff_ids ON users USING GIN(staff_ids);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);

CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    partner_code VARCHAR(50) NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    credit_limit NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_partner_company_code UNIQUE (company_id, partner_code)
);
CREATE INDEX IF NOT EXISTS idx_partners_company_search ON partners(company_id, partner_code, partner_name);

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
CREATE INDEX IF NOT EXISTS idx_items_company_search ON items(company_id, code, name);

CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100) NOT NULL,
    voucher_date DATE NOT NULL,
    voucher_type VARCHAR(10) NOT NULL,
    description TEXT,
    currency VARCHAR(10) DEFAULT 'VND',
    exchange_rate NUMERIC(15,4) DEFAULT 1.0000,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    is_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP DEFAULT NULL,
    posted_by INT REFERENCES users(id) ON DELETE SET NULL,
    loading_status VARCHAR(20) DEFAULT 'pending_loading',
    truck_id INT REFERENCES trucks(id) ON DELETE SET NULL,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    coupon_code VARCHAR(50) DEFAULT NULL,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    shipping_fee NUMERIC(15,2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    sales_channel VARCHAR(50) DEFAULT 'storefront',
    is_reversing BOOLEAN DEFAULT FALSE,
    reversed_from INT DEFAULT NULL REFERENCES vouchers(id) ON DELETE SET NULL,
    due_date DATE,
    hitl_status VARCHAR(20) DEFAULT NULL,
    ai_confidence_score DECIMAL(5,2) DEFAULT NULL,
    sign_status VARCHAR(20) DEFAULT 'unsigned',
    amount NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vouchers_date_company ON vouchers(company_id, voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_status ON vouchers(company_id, is_posted, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date ON vouchers(company_id, voucher_date DESC);

CREATE TABLE IF NOT EXISTS voucher_details (
    id SERIAL PRIMARY KEY,
    voucher_id INT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    entry_type VARCHAR(2) NOT NULL CHECK (entry_type IN ('DR', 'CR')),
    amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
    quantity NUMERIC(15,4) DEFAULT 0,
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
    item_id INT REFERENCES items(id) ON DELETE SET NULL,
    amount_origin NUMERIC(15,2),
    currency_origin VARCHAR(10) DEFAULT 'VND',
    is_tax_deductible BOOLEAN DEFAULT TRUE,
    dimensions JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_voucher_details_lookup ON voucher_details(voucher_id, account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_details_account_entry ON voucher_details(account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_details_voucher_lookup ON voucher_details(voucher_id);
CREATE INDEX IF NOT EXISTS idx_details_partner_account ON voucher_details(partner_id, account_code) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_details_tax_accounts ON voucher_details(account_code) WHERE account_code LIKE '333%';
CREATE INDEX IF NOT EXISTS idx_details_currency ON voucher_details(currency_origin, voucher_id) WHERE currency_origin != 'VND';
CREATE INDEX IF NOT EXISTS idx_voucher_details_company_account_partner ON voucher_details(voucher_id, account_code, entry_type, partner_id);

CREATE TABLE IF NOT EXISTS opening_balances (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    account_code VARCHAR(20) NOT NULL,
    opening_debit NUMERIC(15,2) DEFAULT 0,
    opening_credit NUMERIC(15,2) DEFAULT 0,
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create indexes (with error handling for existing data issues)
DO $$
BEGIN
    -- Clean up duplicate data before creating unique index
    -- Keep only the first record for each duplicate group
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY company_id, account_code, fiscal_year, partner_id 
                   ORDER BY created_at ASC
               ) as rn
        FROM opening_balances
    )
    DELETE FROM opening_balances 
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
    
    -- Create unique index
    DROP INDEX IF EXISTS ux_opening_balances_company_account_year_partner;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_opening_balances_company_account_year_partner 
        ON opening_balances(company_id, account_code, fiscal_year, partner_id);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not create unique index ux_opening_balances_company_account_year_partner: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS idx_opening_balances_lookup ON opening_balances(company_id, fiscal_year, account_code);
CREATE INDEX IF NOT EXISTS idx_opening_balances_company_year_account_partner ON opening_balances(company_id, fiscal_year, account_code, partner_id);

-- ====================================================================
-- 2. SESSIONS & AUDIT
-- ====================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    ip_address VARCHAR(45),
    device_info TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_unique ON sessions(token);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    old_values JSONB DEFAULT NULL,
    new_values JSONB DEFAULT NULL,
    ip_address VARCHAR(45) NOT NULL,
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs(action, entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

-- ====================================================================
-- 3. TRUCKS & LOGISTICS
-- ====================================================================
CREATE TABLE IF NOT EXISTS trucks (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plate_number VARCHAR(20) NOT NULL,
    driver_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_truck_company_plate UNIQUE (company_id, plate_number)
);

-- ====================================================================
-- 4. NOTIFICATIONS & PUSH
-- ====================================================================
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

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_company ON push_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_updated ON push_subscriptions(updated_at);

-- ====================================================================
-- 5. CLOSING & MONTHLY BALANCES
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
    net_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    balance_type VARCHAR(10) NOT NULL DEFAULT 'DEBIT' CHECK (balance_type IN ('DEBIT', 'CREDIT')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- Create indexes (with error handling for existing data issues)
DO $$
BEGIN
    -- Clean up duplicate data before creating unique index
    -- Keep only the first record for each duplicate group
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY company_id, account_code, COALESCE(partner_id, 0), month, year 
                   ORDER BY created_at ASC
               ) as rn
        FROM monthly_balances
    )
    DELETE FROM monthly_balances 
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
    
    -- Create unique index
    DROP INDEX IF EXISTS ux_monthly_balances_company_account_partner_month_year;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_monthly_balances_company_account_partner_month_year
        ON monthly_balances(company_id, account_code, COALESCE(partner_id, 0), month, year);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not create unique index ux_monthly_balances_company_account_partner_month_year: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS idx_monthly_balances_lookup ON monthly_balances(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_account ON monthly_balances(account_code);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_partner ON monthly_balances(partner_id, account_code) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_monthly_balances_net_balance ON monthly_balances(company_id, year, month, balance_type);

-- ====================================================================
-- 6. INVENTORY
-- ====================================================================
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

CREATE TABLE IF NOT EXISTS inventory_costing_layers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id INT REFERENCES items(id) ON DELETE SET NULL,
    layer_type VARCHAR(10) NOT NULL CHECK (layer_type IN ('AVCO', 'FIFO', 'STANDARD')),
    remaining_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    effective_date DATE NOT NULL,
    voucher_id INT REFERENCES vouchers(id) ON DELETE SET NULL,
    reference_no VARCHAR(100),
    is_consumed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_costing_layers_product ON inventory_costing_layers(company_id, product_id);
CREATE INDEX IF NOT EXISTS idx_costing_layers_effective ON inventory_costing_layers(effective_date);

CREATE TABLE IF NOT EXISTS stock_reconciliations (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100) NOT NULL,
    reconciliation_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
    description TEXT,
    total_adjustment_amount NUMERIC(15,2) DEFAULT 0,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliations_company ON stock_reconciliations(company_id, reconciliation_date);

CREATE TABLE IF NOT EXISTS stock_reconciliation_details (
    id SERIAL PRIMARY KEY,
    stock_reconciliation_id INT NOT NULL REFERENCES stock_reconciliations(id) ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    system_quantity NUMERIC(15,4) NOT NULL,
    actual_quantity NUMERIC(15,4) NOT NULL,
    difference_quantity NUMERIC(15,4) NOT NULL,
    system_value NUMERIC(15,2) NOT NULL,
    actual_value NUMERIC(15,2) NOT NULL,
    adjustment_amount NUMERIC(15,2) NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL,
    account_code VARCHAR(20) NOT NULL DEFAULT '156',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliation_details_master ON stock_reconciliation_details(stock_reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_stock_reconciliation_details_item ON stock_reconciliation_details(item_id);

-- ====================================================================
-- 7. COSTING STRATEGIES
-- ====================================================================
CREATE TABLE IF NOT EXISTS costing_strategies (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    strategy_name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(20) NOT NULL CHECK (strategy_type IN ('AVCO', 'FIFO', 'STANDARD')),
    sku_pattern VARCHAR(100),
    product_id INT REFERENCES items(id) ON DELETE SET NULL,
    warehouse_id INT,
    priority INT NOT NULL DEFAULT 0,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_costing_strategies_company ON costing_strategies(company_id);

-- ====================================================================
-- 8. ACCOUNTING PERIODS
-- ====================================================================
CREATE TABLE IF NOT EXISTS accounting_periods (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    period_status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (period_status IN ('open', 'closed', 'locked')),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_accounting_periods ON accounting_periods(company_id, fiscal_year, period_number);

-- ====================================================================
-- 9. ACCOUNTS (Legacy Chart of Accounts)
-- ====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        CREATE TABLE accounts (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            code VARCHAR(20) NOT NULL,
            name VARCHAR(255) NOT NULL,
            parent_code VARCHAR(20) DEFAULT NULL,
            level INTEGER DEFAULT 1,
            type VARCHAR(50) NOT NULL,
            subtype VARCHAR(50),
            account_type VARCHAR(20),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_account_company_code UNIQUE (company_id, code)
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_code);
        CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
    END IF;
END $$;

-- ====================================================================
-- 10. CHART OF ACCOUNTS (System default)
-- ====================================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_chart_of_accounts_code ON chart_of_accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_active ON chart_of_accounts(is_active);

-- ====================================================================
-- 11. E-INVOICES
-- ====================================================================
CREATE TABLE IF NOT EXISTS e_invoices (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_no VARCHAR(100) NOT NULL,
    template VARCHAR(20) NOT NULL DEFAULT '01GTKT0',
    symbol VARCHAR(50) NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_tax_code VARCHAR(50) DEFAULT NULL,
    buyer_address TEXT DEFAULT NULL,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    voucher_id INT DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'issued',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_e_invoices_company_invoice_no ON e_invoices(company_id, invoice_no);
CREATE INDEX IF NOT EXISTS idx_e_invoices_company ON e_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_e_invoices_issued_at ON e_invoices(issued_at DESC);

-- ====================================================================
-- 12. CONSENTS, COMPLAINTS, REFUNDS
-- ====================================================================
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_type VARCHAR(50) NOT NULL,
    policy_version VARCHAR(20) NOT NULL,
    agreed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT DEFAULT NULL,
    CONSTRAINT ux_consents_user_policy UNIQUE (user_id, policy_type, policy_version)
);
CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id);

CREATE TABLE IF NOT EXISTS company_profiles (
    company_id INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    hotline VARCHAR(50) DEFAULT NULL,
    website VARCHAR(255) DEFAULT NULL,
    license_no VARCHAR(100) DEFAULT NULL,
    dpo_name VARCHAR(255) DEFAULT NULL,
    dpo_email VARCHAR(255) DEFAULT NULL,
    data_retention_days INT DEFAULT 3650,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_complaints_company ON complaints(company_id);

CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    voucher_id INT DEFAULT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_company ON refund_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

-- ====================================================================
-- 13. DEBT RECONCILIATIONS
-- ====================================================================
CREATE TABLE IF NOT EXISTS debt_reconciliations (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100) NOT NULL,
    reconciliation_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'offsetting' CHECK (type IN ('offsetting', 'intercompany')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
    description TEXT,
    total_offset_amount NUMERIC(15,2) DEFAULT 0,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_debt_reconciliations_company ON debt_reconciliations(company_id, reconciliation_date);

CREATE TABLE IF NOT EXISTS debt_reconciliation_details (
    id SERIAL PRIMARY KEY,
    debt_reconciliation_id INT NOT NULL REFERENCES debt_reconciliations(id) ON DELETE CASCADE,
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    receivable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    offset_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    remaining_receivable NUMERIC(15,2) NOT NULL DEFAULT 0,
    remaining_payable NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_debt_reconciliation_details_master ON debt_reconciliation_details(debt_reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_debt_reconciliation_details_partner ON debt_reconciliation_details(partner_id);

-- ====================================================================
-- 14. REA (Resources-Events-Agents) LAYER
-- ====================================================================
CREATE TABLE IF NOT EXISTS rea_meta (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    table_name VARCHAR(100),
    ui_schema JSONB NOT NULL DEFAULT '{}',
    grid_columns JSONB NOT NULL DEFAULT '[]',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    version INT DEFAULT 1,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (entity_type, company_id, version)
);
CREATE INDEX IF NOT EXISTS idx_rea_meta_active ON rea_meta(company_id, entity_type) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS rea_events (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    resources JSONB DEFAULT '[]',
    agents JSONB DEFAULT '[]',
    accounting_entries JSONB DEFAULT '[]',
    voucher_id INT REFERENCES vouchers(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rea_events_company ON rea_events(company_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rea_events_event_type ON rea_events(event_type);

CREATE TABLE IF NOT EXISTS rea_event_processors (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    debits JSONB DEFAULT '[]',
    credits JSONB DEFAULT '[]',
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rea_event_processors_active ON rea_event_processors(event_type, company_id) WHERE is_active = TRUE;

-- ====================================================================
-- 15. IO COEFFICIENTS (Leontief Matrix)
-- ====================================================================
CREATE TABLE IF NOT EXISTS io_coefficients (
    id SERIAL PRIMARY KEY,
    from_company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    to_company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    coefficient NUMERIC(15,6) NOT NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_io_coefficient UNIQUE (from_company_id, to_company_id, resource_type, valid_from)
);
CREATE INDEX IF NOT EXISTS idx_io_coefficients_lookup ON io_coefficients(from_company_id, to_company_id);

-- ====================================================================
-- 16. IDEMPOTENCY KEYS
-- ====================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    result JSONB DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP DEFAULT NULL,
    CONSTRAINT ux_idempotency_keys UNIQUE (company_id, event_type, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup ON idempotency_keys(company_id, event_type, idempotency_key);

-- ====================================================================
-- 17. EVENT STORE (CQRS)
-- ====================================================================
CREATE TABLE IF NOT EXISTS event_store (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    correlation_id VARCHAR(100),
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_store_company ON event_store(company_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_store_correlation ON event_store(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_store_category ON event_store(category, severity);
CREATE INDEX IF NOT EXISTS idx_event_store_cleanup ON event_store(created_at) WHERE severity = 'info';

-- ====================================================================
-- 18. ACCOUNTING POSTING RULES (Dynamic Posting Engine)
-- ====================================================================
CREATE TABLE IF NOT EXISTS accounting_posting_rules (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    rule_condition JSONB DEFAULT '{}',
    priority INT NOT NULL DEFAULT 0,
    debits JSONB NOT NULL,
    credits JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posting_rules_active ON accounting_posting_rules(company_id, event_type) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS account_resolvers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    resolver_name VARCHAR(100) NOT NULL,
    resolver_type VARCHAR(20) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_resolvers ON account_resolvers(company_id);

-- ====================================================================
-- 19. ACCOUNT DIMENSION BALANCES (CQRS Projection)
-- ====================================================================
CREATE TABLE IF NOT EXISTS account_dimension_balances (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    dimension_key VARCHAR(100) DEFAULT 'default',
    dimension_value VARCHAR(100) DEFAULT 'default',
    debit_accumulated NUMERIC(18,2) NOT NULL DEFAULT 0,
    credit_accumulated NUMERIC(18,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    CONSTRAINT ux_dim_balances UNIQUE (company_id, account_code, dimension_key, dimension_value)
);
CREATE INDEX IF NOT EXISTS idx_dim_balances_company ON account_dimension_balances(company_id);

CREATE TABLE IF NOT EXISTS projection_log (
    id BIGSERIAL PRIMARY KEY,
    voucher_id INT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    company_id INT NOT NULL,
    projection_type VARCHAR(50) NOT NULL DEFAULT 'ACCOUNT_DIMENSION_BALANCE',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projection_log_status ON projection_log(status);
CREATE INDEX IF NOT EXISTS idx_projection_log_voucher ON projection_log(voucher_id);

CREATE TABLE IF NOT EXISTS report_cache (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL,
    report_key VARCHAR(255) NOT NULL,
    report_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_cache_lookup ON report_cache(company_id, report_key);
CREATE INDEX IF NOT EXISTS idx_report_cache_expires ON report_cache(expires_at);

-- ====================================================================
-- 20. AI HITL LOGS (Human-in-the-Loop / RLHF)
-- ====================================================================
CREATE TABLE IF NOT EXISTS ai_hitl_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    voucher_id BIGINT REFERENCES vouchers(id) ON DELETE CASCADE,
    ai_confidence_score DECIMAL(5,2) NOT NULL CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
    original_ai_proposal JSONB NOT NULL,
    final_human_approved JSONB NOT NULL,
    is_modified BOOLEAN DEFAULT FALSE,
    modified_fields TEXT[],
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ai_model_version VARCHAR(50) DEFAULT 'v1.0',
    processing_status VARCHAR(20) DEFAULT 'pending',
    self_fix_attempts INTEGER DEFAULT 0,
    ai_fix_history JSONB DEFAULT '[]'::jsonb,
    is_self_fixed BOOLEAN DEFAULT FALSE,
    last_self_fix_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_tenant ON ai_hitl_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_voucher ON ai_hitl_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_user ON ai_hitl_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_confidence ON ai_hitl_logs(ai_confidence_score);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_modified ON ai_hitl_logs(is_modified) WHERE is_modified = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_status ON ai_hitl_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_logs_created ON ai_hitl_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_hitl_self_fix ON ai_hitl_logs(tenant_id, self_fix_attempts, processing_status);

-- ====================================================================
-- 21. AI CIRCUIT BREAKER & MODEL VERSIONS
-- ====================================================================
CREATE TABLE IF NOT EXISTS ai_circuit_breaker (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    model_name VARCHAR(50) NOT NULL,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP DEFAULT NOW(),
    is_open BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_circuit_tenant ON ai_circuit_breaker (tenant_id, model_name);

CREATE TABLE IF NOT EXISTS ai_model_versions (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    accuracy_score NUMERIC(5,2) DEFAULT 0,
    training_data_count INTEGER DEFAULT 0,
    deployed_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_model_active ON ai_model_versions(is_active DESC, deployed_at DESC);

-- ====================================================================
-- 22. AI CONFIGURATIONS (Data-Driven)
-- ====================================================================
CREATE TABLE IF NOT EXISTS ai_copilot_kb (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    sql_query TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_kb_company ON ai_copilot_kb(company_id);

CREATE TABLE IF NOT EXISTS ai_departments (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(50) UNIQUE NOT NULL,
    department_name VARCHAR(255) NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    account_codes VARCHAR(20)[] DEFAULT '{}',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_workflow_matrix (
    id SERIAL PRIMARY KEY,
    workflow_code VARCHAR(50) UNIQUE NOT NULL,
    workflow_name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]',
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_suggestion_rules (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(50) UNIQUE NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    trigger_keywords TEXT[] DEFAULT '{}',
    trigger_accounts VARCHAR(20)[] DEFAULT '{}',
    suggested_accounts VARCHAR(20)[] DEFAULT '{}',
    suggested_entries JSONB DEFAULT '[]',
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_batch_configs (
    id SERIAL PRIMARY KEY,
    config_code VARCHAR(50) UNIQUE NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    max_batch_size INT DEFAULT 100,
    parallel_workers INT DEFAULT 5,
    confidence_threshold NUMERIC(5,2) DEFAULT 90,
    auto_approve_threshold NUMERIC(5,2) DEFAULT 95,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_workflow_history (
    id BIGSERIAL PRIMARY KEY,
    workflow_id VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    steps JSONB DEFAULT '[]'::jsonb,
    final_status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (final_status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PENDING_HUMAN_REVIEW')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_history_workflow_id ON ai_workflow_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_history_company ON ai_workflow_history(company_id, workflow_type);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_history_status ON ai_workflow_history(final_status);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_history_created ON ai_workflow_history(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    suggestion_data JSONB DEFAULT '{}',
    confidence_score NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- 23. AI MONITORING & ANOMALY DETECTION
-- ====================================================================
CREATE TABLE IF NOT EXISTS anomaly_reports (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_id BIGINT REFERENCES rea_events(id) ON DELETE SET NULL,
    ai_suggestion_id BIGINT REFERENCES ai_suggestions(id) ON DELETE SET NULL,
    anomaly_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    detection_method VARCHAR(50) DEFAULT 'pattern_match',
    detection_data JSONB DEFAULT '{}',
    confidence_score NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_reports_company_id ON anomaly_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_reports_severity ON anomaly_reports(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_reports_status ON anomaly_reports(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_reports_company_status ON anomaly_reports(company_id, status, created_at DESC) WHERE status != 'dismissed';

CREATE TABLE IF NOT EXISTS ai_monitoring_metrics (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    metric_hour INT CHECK (metric_hour BETWEEN 0 AND 23),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(18,4) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- 24. AI OCR RESULTS
-- ====================================================================
CREATE TABLE IF NOT EXISTS ai_ocr_results (
    id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_id BIGINT REFERENCES vouchers(id) ON DELETE CASCADE,
    file_url TEXT,
    raw_text TEXT,
    processed_data JSONB DEFAULT '{}',
    confidence_score NUMERIC(5,2) DEFAULT 0,
    processing_time_ms INT DEFAULT 0,
    model_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_ocr_results_company ON ai_ocr_results(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_ocr_results_voucher ON ai_ocr_results(voucher_id);

-- ====================================================================
-- 25. TRANSACTION CLASSIFICATION
-- ====================================================================
CREATE TABLE IF NOT EXISTS transaction_classification_rules (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('keyword', 'pattern', 'account', 'amount_range', 'partner_type')),
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    conditions JSONB NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('set_account', 'set_department', 'set_voucher_type', 'set_entry_type', 'set_partner_type')),
    action_value JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transaction_classification_rules_company ON transaction_classification_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_transaction_classification_rules_priority ON transaction_classification_rules(priority);
CREATE INDEX IF NOT EXISTS idx_transaction_classification_rules_active ON transaction_classification_rules(is_active);

CREATE TABLE IF NOT EXISTS transaction_classifications (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
    voucher_detail_id INTEGER REFERENCES voucher_details(id) ON DELETE SET NULL,
    description TEXT,
    amount NUMERIC(15,2),
    account_code VARCHAR(20),
    partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL,
    suggested_account_code VARCHAR(20),
    suggested_department_code VARCHAR(50),
    suggested_entry_type VARCHAR(2) CHECK (suggested_entry_type IN ('DR', 'CR')),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    source VARCHAR(20) NOT NULL CHECK (source IN ('rule', 'ai_department', 'ai_ocr', 'manual')),
    rule_id INTEGER REFERENCES transaction_classification_rules(id) ON DELETE SET NULL,
    is_accepted BOOLEAN DEFAULT NULL,
    accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transaction_classifications_company ON transaction_classifications(company_id);

-- ====================================================================
-- 26. CASSO BANKING INTEGRATION
-- ====================================================================
CREATE TABLE IF NOT EXISTS casso_company_accounts (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    bank_name VARCHAR(100),
    account_number VARCHAR(50) NOT NULL,
    owner_name VARCHAR(255),
    bank_sub_acc_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_casso_accounts_company ON casso_company_accounts(company_id);

CREATE TABLE IF NOT EXISTS casso_webhooks (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    webhook_url TEXT,
    secure_token VARCHAR(255),
    scope VARCHAR(20) DEFAULT 'company',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_casso_webhooks_company ON casso_webhooks(company_id);

CREATE TABLE IF NOT EXISTS casso_transactions (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    casso_tx_id VARCHAR(100),
    company_account_id INT REFERENCES casso_company_accounts(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    transaction_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    voucher_id INT REFERENCES vouchers(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_casso_transactions_company ON casso_transactions(company_id);

-- ====================================================================
-- 27. OTP SIGNING SYSTEM
-- ====================================================================
CREATE TABLE IF NOT EXISTS otp_signatures (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    document_id INT NOT NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'voucher',
    otp_hash VARCHAR(255) NOT NULL,
    sign_status VARCHAR(20) DEFAULT 'pending' CHECK (sign_status IN ('pending', 'signed', 'expired', 'cancelled')),
    sign_channel VARCHAR(20) DEFAULT 'email',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_signatures_document ON otp_signatures(document_id, company_id);
CREATE INDEX IF NOT EXISTS idx_otp_signatures_user ON otp_signatures(user_id);

-- ====================================================================
-- 28. WORKFLOW ENGINE (User-Defined)
-- ====================================================================
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50),
    trigger_event VARCHAR(100),
    steps JSONB DEFAULT '[]',
    variables JSONB DEFAULT '{}',
    is_system_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_code VARCHAR(50) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100),
    steps JSONB DEFAULT '[]',
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_company ON workflows(company_id);

CREATE TABLE IF NOT EXISTS workflow_instances (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_event VARCHAR(100),
    trigger_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'running',
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow ON workflow_instances(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id SERIAL PRIMARY KEY,
    instance_id INT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    workflow_id INT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    step_name VARCHAR(255),
    step_type VARCHAR(50),
    action_type VARCHAR(50),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_instance ON workflow_step_executions(instance_id);

-- ====================================================================
-- 29. EXTERNAL API REGISTRY
-- ====================================================================
CREATE TABLE IF NOT EXISTS external_apis (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    description TEXT,
    base_url VARCHAR(500) NOT NULL,
    api_version VARCHAR(20),
    auth_type VARCHAR(50) NOT NULL DEFAULT 'bearer',
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    config JSONB NOT NULL DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    timeout INTEGER NOT NULL DEFAULT 30000,
    retry_count INTEGER NOT NULL DEFAULT 3,
    retry_delay INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_health_check TIMESTAMP,
    health_status VARCHAR(20) DEFAULT 'unknown',
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_auth_type CHECK (auth_type IN ('bearer', 'basic', 'api_key', 'oauth2', 'custom')),
    CONSTRAINT valid_health_status CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'down'))
);
CREATE INDEX IF NOT EXISTS idx_external_apis_service_type ON external_apis(service_type);
CREATE INDEX IF NOT EXISTS idx_external_apis_company_id ON external_apis(company_id);
CREATE INDEX IF NOT EXISTS idx_external_apis_is_active ON external_apis(is_active);

CREATE TABLE IF NOT EXISTS integration_logs (
    id BIGSERIAL PRIMARY KEY,
    external_api_id INTEGER REFERENCES external_apis(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    request_method VARCHAR(10) NOT NULL,
    request_url TEXT NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_headers JSONB,
    response_body JSONB,
    request_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    response_received_at TIMESTAMP,
    duration_ms INTEGER,
    is_success BOOLEAN,
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_logs_api ON integration_logs(external_api_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_company ON integration_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);

-- ====================================================================
-- 30. SYSTEM CONFIGS (DB-driven configuration)
-- ====================================================================
CREATE TABLE IF NOT EXISTS system_configs (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    value_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category);
CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_company ON system_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_system_configs_deleted ON system_configs(deleted_at) WHERE deleted_at IS NOT NULL;

-- ====================================================================
-- 31. FEATURE FLAGS
-- ====================================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 32. DEMO / DYNAMIC ENTITY
-- ====================================================================
CREATE TABLE IF NOT EXISTS demo_entity (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    amount NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_entity_company ON demo_entity(company_id);

-- ====================================================================
-- 33. REPORTS (User-defined reports)
-- ====================================================================
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('balance_sheet', 'income_statement', 'cashflow', 'trial_balance', 'account_ledger', 'partner_ledger', 'tax_report', 'custom')),
    report_config JSONB NOT NULL DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_config JSONB DEFAULT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);

-- ====================================================================
-- 34. ORDERS & ORDER DETAILS (Legacy storefront)
-- ====================================================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_number VARCHAR(100),
    customer_name VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    total_amount NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP DEFAULT NULL,
    partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_details (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_details_order ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_item ON order_details(item_id);

-- ====================================================================
-- 35. PAYROLL
-- ====================================================================
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    base_salary NUMERIC(15,2) DEFAULT 0,
    bonus NUMERIC(15,2) DEFAULT 0,
    insurance NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    net_pay NUMERIC(15,2) DEFAULT 0,
    period_month INT,
    period_year INT,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================================================
-- 36. SYSTEM FUNCTIONS
-- ====================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_push_subscriptions()
RETURNS void AS $$
BEGIN
    DELETE FROM push_subscriptions
    WHERE updated_at < NOW() - INTERVAL '90 days'
    AND id NOT IN (SELECT user_id FROM sessions WHERE expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_system_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 37. CORE SEED DATA (Defaults - idempotent)
-- ====================================================================
INSERT INTO chart_of_accounts (account_code, account_name, account_type, is_system_default) VALUES
    ('111', 'Tiền mặt tại quỹ', 'asset', true),
    ('112', 'Tiền gửi Ngân hàng', 'asset', true),
    ('131', 'Phải thu của khách hàng', 'asset', true),
    ('138', 'Phải thu khác', 'asset', true),
    ('141', 'Tạm ứng', 'asset', true),
    ('152', 'Nguyên liệu, vật liệu tồn kho', 'asset', true),
    ('153', 'Công cụ, dụng cụ', 'asset', true),
    ('156', 'Hàng hóa kho tổng', 'asset', true),
    ('211', 'Tài sản cố định hữu hình', 'asset', true),
    ('214', 'Hao mòn tài sản cố định', 'asset', true),
    ('215', 'Tài sản sinh học', 'asset', true),
    ('229', 'Dự phòng tổn thất tài sản', 'asset', true),
    ('242', 'Chi phí trả trước', 'asset', true),
    ('331', 'Phải trả cho người bán', 'liability', true),
    ('333', 'Thuế và các khoản phải nộp Nhà nước', 'liability', true),
    ('334', 'Phải trả người lao động', 'liability', true),
    ('335', 'Quỹ dự phòng trợ cấp mất việc làm', 'liability', true),
    ('338', 'Phải trả, phải nộp khác', 'liability', true),
    ('341', 'Vay và nợ thuê tài chính', 'liability', true),
    ('411', 'Vốn đầu tư của chủ sở hữu', 'equity', true),
    ('418', 'Quỹ đầu tư phát triển', 'equity', true),
    ('421', 'Lợi nhuận sau thuế chưa phân phối', 'equity', true),
    ('511', 'Doanh thu bán hàng', 'revenue', true),
    ('515', 'Doanh thu hoạt động tài chính', 'revenue', true),
    ('611', 'Chi phí mua hàng', 'expense', true),
    ('632', 'Giá vốn hàng bán', 'expense', true),
    ('635', 'Chi phí bán hàng', 'expense', true),
    ('641', 'Chi phí quản lý doanh nghiệp', 'expense', true),
    ('642', 'Chi phí sản xuất, kinh doanh', 'expense', true),
    ('711', 'Thu nhập khác', 'revenue', true),
    ('811', 'Chi phí khác', 'expense', true),
    ('821', 'Chi phí thuế TNDN', 'expense', true),
    ('911', 'Xác định kết quả kinh doanh', 'closing', true)
ON CONFLICT DO NOTHING;

INSERT INTO feature_flags (flag_name, is_enabled, description) VALUES
    ('basic-accounting', true, 'Core accounting features'),
    ('advanced-reports', true, 'Advanced financial reports'),
    ('multi-currency', false, 'Multi-currency support')
ON CONFLICT DO NOTHING;

INSERT INTO ai_departments (department_code, department_name, keywords, account_codes, description) VALUES
    ('finance', 'Phòng Tài chính - Kế toán', ARRAY['kế toán', 'tài chính', 'hạch toán', 'thuế', 'lương'], ARRAY['111','112','131','331','511','632','641','642'], 'Phòng kế toán tổng hợp'),
    ('sales', 'Phòng Kinh doanh - Bán hàng', ARRAY['bán hàng', 'doanh thu', 'khách hàng', 'hợp đồng', 'đơn hàng'], ARRAY['131','511'], 'Phòng kinh doanh'),
    ('warehouse', 'Phòng Kho - Logistics', ARRAY['nhập kho', 'xuất kho', 'tồn kho', 'hàng hóa', 'vật tư'], ARRAY['152','156','632'], 'Phòng quản lý kho'),
    ('hr', 'Phòng Nhân sự', ARRAY['nhân sự', 'lương', 'tuyển dụng', 'đào tạo'], ARRAY['334'], 'Phòng nhân sự'),
    ('admin', 'Phòng Hành chính - Quản trị', ARRAY['hành chính', 'quản trị', 'văn phòng', 'công văn'], ARRAY['641','642'], 'Phòng hành chính')
ON CONFLICT DO NOTHING;

INSERT INTO ai_batch_configs (config_code, config_name, max_batch_size, parallel_workers, confidence_threshold, auto_approve_threshold) VALUES
    ('invoice_batch', 'Batch Invoice Processing', 100, 5, 90, 95)
ON CONFLICT DO NOTHING;

-- Seed default system configs
INSERT INTO system_configs (config_key, config_value, value_type, category, description, is_active) VALUES
    ('tax.standard_rate', '8', 'number', 'TAX_RATES', 'Thuế GTGT chuẩn 8%', true),
    ('company.default_tax_rate', '8', 'number', 'TAX_RATES', 'Thuế GTGT mặc định cho công ty', true),
    ('currency.default', 'VND', 'string', 'GENERAL', 'Đơn vị tiền tệ mặc định', true),
    ('order.payment_methods', '["cod","bank_transfer","casso"]', 'json', 'ORDERS', 'Phương thức thanh toán khả dụng', true)
ON CONFLICT (config_key) DO NOTHING;
