/**
 * Run AI Copilot KB migration
 * This script creates the ai_copilot_kb table
 */

import { pool } from './config/db.js';

const migrationSQL = `
-- ====================================================================
-- BẢNG AI COPILOT KNOWLEDGE BASE
-- ====================================================================
-- Lưu trữ câu hỏi thường gặp và câu trả lời

CREATE TABLE IF NOT EXISTS ai_copilot_kb (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    sql_query TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INT REFERENCES users(id) ON DELETE SET NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_copilot_kb_company ON ai_copilot_kb(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_kb_created ON ai_copilot_kb(created_at DESC);

-- Thêm cột due_date cho vouchers nếu chưa có
ALTER TABLE vouchers 
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Thêm cột account_type cho bảng accounts nếu chưa có
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);

-- Cập nhật account_type dựa trên mã tài khoản
UPDATE accounts 
SET account_type = CASE 
  WHEN account_code LIKE '111%' OR account_code LIKE '112%' THEN 'cash'
  WHEN account_code LIKE '131%' OR account_code LIKE '132%' THEN 'receivable'
  WHEN account_code LIKE '141%' THEN 'inventory'
  WHEN account_code LIKE '331%' OR account_code LIKE '332%' THEN 'payable'
  WHEN account_code LIKE '4%' THEN 'revenue'
  WHEN account_code LIKE '5%' THEN 'expense'
  WHEN account_code LIKE '6%' OR account_code LIKE '7%' OR account_code LIKE '8%' THEN 'cost'
  ELSE 'other'
END
WHERE account_type IS NULL;
`;

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running AI Copilot KB migration...');
    
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!');
      console.log('Created table: ai_copilot_kb');
      console.log('Added columns: vouchers.due_date, chart_of_accounts.account_type');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();