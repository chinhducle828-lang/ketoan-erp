-- Full schema sync for Railway Postgres.
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    lock_date DATE DEFAULT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, company_id)
);

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_partner_company_code UNIQUE (company_id, partner_code)
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50) DEFAULT 'Cai',
    price_sell NUMERIC(15,2) DEFAULT 0,
    opening_quantity NUMERIC(15,4) DEFAULT 0,
    image_url TEXT,
    image_urls JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_item_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_number VARCHAR(100),
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
    truck_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    currency_origin VARCHAR(10) DEFAULT 'VND'
);

CREATE TABLE IF NOT EXISTS opening_balances (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    account_code VARCHAR(20) NOT NULL,
    opening_debit NUMERIC(15,2) DEFAULT 0,
    opening_credit NUMERIC(15,2) DEFAULT 0,
    partner_id INT REFERENCES partners(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_opening_balance UNIQUE (company_id, account_code, fiscal_year, partner_id)
);

CREATE TABLE IF NOT EXISTS trucks (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plate_number VARCHAR(20) NOT NULL,
    driver_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_truck_company_plate UNIQUE (company_id, plate_number)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    old_values JSONB DEFAULT NULL,
    new_values JSONB DEFAULT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS monthly_balances (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    partner_id INT NULL REFERENCES partners(id) ON DELETE SET NULL,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    year INT NOT NULL,
    closing_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
    closing_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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

-- Compatibility / legacy columns used by older flows and tests
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year INT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lock_date DATE DEFAULT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_ids INT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_ids INT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_root_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'Cai';
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_sell NUMERIC(15,2) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS opening_quantity NUMERIC(15,4) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]';

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS voucher_number VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'VND';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,4) DEFAULT 1.0000;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS loading_status VARCHAR(20) DEFAULT 'pending_loading';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS truck_id INT DEFAULT NULL;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS account_dr VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS account_cr VARCHAR(20);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2);

ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS quantity NUMERIC(15,4) DEFAULT 0;
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS partner_id INT REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS item_id INT REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS amount_origin NUMERIC(15,2);
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS currency_origin VARCHAR(10) DEFAULT 'VND';

ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS opening_debit NUMERIC(15,2) DEFAULT 0;
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS opening_credit NUMERIC(15,2) DEFAULT 0;
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS debit_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE opening_balances ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Backfill legacy/new aliases once
UPDATE companies
SET company_name = COALESCE(NULLIF(company_name, ''), name)
WHERE company_name IS NULL OR company_name = '';

UPDATE items
SET item_code = COALESCE(NULLIF(item_code, ''), code),
    item_name = COALESCE(NULLIF(item_name, ''), name)
WHERE item_code IS NULL OR item_code = '' OR item_name IS NULL OR item_name = '';

UPDATE opening_balances
SET opening_debit = COALESCE(opening_debit, debit_balance, 0),
    opening_credit = COALESCE(opening_credit, credit_balance, 0),
    debit_balance = COALESCE(debit_balance, opening_debit, 0),
    credit_balance = COALESCE(credit_balance, opening_credit, 0);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_truck_id_fk') THEN
    ALTER TABLE vouchers
    ADD CONSTRAINT vouchers_truck_id_fk
    FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL;
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_users_company_ids ON users USING GIN(company_ids);
CREATE INDEX IF NOT EXISTS idx_users_staff_ids ON users USING GIN(staff_ids);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date ON vouchers(company_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_status ON vouchers(company_id, is_posted, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;
CREATE INDEX IF NOT EXISTS idx_voucher_details_lookup ON voucher_details(voucher_id, account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_details_account_entry ON voucher_details(account_code, entry_type);
CREATE INDEX IF NOT EXISTS idx_details_voucher_lookup ON voucher_details(voucher_id);
CREATE INDEX IF NOT EXISTS idx_details_partner_account ON voucher_details(partner_id, account_code) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_details_currency ON voucher_details(currency_origin, voucher_id) WHERE currency_origin <> 'VND';
CREATE INDEX IF NOT EXISTS idx_opening_balances_lookup ON opening_balances(company_id, fiscal_year, account_code);
CREATE INDEX IF NOT EXISTS idx_partners_company_search ON partners(company_id, partner_code, partner_name);
CREATE INDEX IF NOT EXISTS idx_items_company_search ON items(company_id, code, name);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs(action, entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, is_read);
CREATE INDEX IF NOT EXISTS idx_closing_entries_lookup ON closing_entries(company_id, year, month, status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_monthly_balances_company_account_partner_month_year
ON monthly_balances(company_id, account_code, COALESCE(partner_id, 0), month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_lookup ON monthly_balances(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_account ON monthly_balances(account_code);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_partner ON monthly_balances(partner_id, account_code) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_vouchers_company_date ON inventory_vouchers(company_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_voucher_details_master ON inventory_voucher_details(inventory_voucher_id);
CREATE INDEX IF NOT EXISTS idx_inventory_voucher_details_item ON inventory_voucher_details(item_id);

COMMIT;
