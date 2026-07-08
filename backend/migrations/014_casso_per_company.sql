-- ====================================================================
-- CASSO PER-COMPANY CONFIG: GLOBAL WEBHOOK + COMPANY BANK ACCOUNTS
-- ====================================================================

-- 1. Update casso_webhooks to support a single global webhook row
ALTER TABLE casso_webhooks
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Allow company_id to be NULL for the global webhook row
ALTER TABLE casso_webhooks
  ALTER COLUMN company_id DROP NOT NULL;

-- Unique index for the single global webhook
CREATE UNIQUE INDEX IF NOT EXISTS ux_casso_webhooks_global
  ON casso_webhooks(scope)
  WHERE scope = 'global';

-- Fix missing unique constraint used by saveWebhookRecord ON CONFLICT (company_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_casso_webhooks_company
  ON casso_webhooks(company_id)
  WHERE company_id IS NOT NULL;

-- 2. Company-specific bank accounts mapped to Casso bank_sub_acc_id
CREATE TABLE IF NOT EXISTS casso_company_accounts (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    bank_sub_acc_id VARCHAR(100) NOT NULL,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    owner_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_casso_company_accounts_sub_acc UNIQUE (bank_sub_acc_id)
);

CREATE INDEX IF NOT EXISTS idx_casso_company_accounts_company
  ON casso_company_accounts(company_id);

CREATE INDEX IF NOT EXISTS idx_casso_company_accounts_sub_acc
  ON casso_company_accounts(bank_sub_acc_id);