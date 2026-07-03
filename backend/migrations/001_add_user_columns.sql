-- Migration: Add missing columns to users table
-- Run this if you already have a database with the old schema

-- Add company_ids array column
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_ids INT[] DEFAULT '{}';

-- Add staff_ids array column
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_ids INT[] DEFAULT '{}';

-- Add manager_id foreign key
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Add must_change_password column
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add preferences JSONB column
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Drop old company_id column if it exists (optional, only if you're sure)
-- ALTER TABLE users DROP COLUMN IF EXISTS company_id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_company_ids ON users USING GIN(company_ids);
CREATE INDEX IF NOT EXISTS idx_users_staff_ids ON users USING GIN(staff_ids);