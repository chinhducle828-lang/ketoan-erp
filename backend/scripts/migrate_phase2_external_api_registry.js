/**
 * Phase 2: External API Registry Migration
 * =========================================
 * Creates flexible schema for external integrations
 * Replaces hard-coded values with database-driven configuration
 */

import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function executeSQL(sql, description) {
  try {
    await pool.query(sql);
    await log(`   ✓ ${description}`, 'success');
  } catch (err) {
    if (err.message.includes('already exists')) {
      await log(`   ⚠️ ${description} (already exists)`, 'warning');
    } else {
      throw new Error(`Failed to ${description}: ${err.message}`);
    }
  }
}

async function migrate() {
  await log('🌐 Phase 2: External API Registry\n');
  await log('='.repeat(60));

  try {
    await log('Creating table: external_apis');
    
    // 1. Create external_apis table
    await executeSQL(`
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
      )
    `, 'Created external_apis table');

    await log('\nCreating table: integration_logs');
    
    // 2. Create integration_logs table
    await executeSQL(`
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
        retry_attempt INTEGER NOT NULL DEFAULT 0,
        is_retry BOOLEAN NOT NULL DEFAULT false,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        correlation_id VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_request_method CHECK (request_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'))
      )
    `, 'Created integration_logs table');

    await log('\nCreating table: system_configs');
    
    // 3. Create system_configs table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id BIGSERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        value_type VARCHAR(20) NOT NULL DEFAULT 'string',
        description TEXT,
        category VARCHAR(50) NOT NULL,
        is_encrypted BOOLEAN NOT NULL DEFAULT false,
        is_sensitive BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT valid_value_type CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'array'))
      )
    `, 'Created system_configs table');

    await log('\nCreating indexes...');
    
    // 4. Create indexes
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_external_apis_service_type ON external_apis(service_type)', 'Created index on external_apis.service_type');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_external_apis_company_id ON external_apis(company_id)', 'Created index on external_apis.company_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_external_apis_is_active ON external_apis(is_active)', 'Created index on external_apis.is_active');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_external_apis_config_gin ON external_apis USING GIN(config)', 'Created GIN index on external_apis.config');
    
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_integration_logs_external_api_id ON integration_logs(external_api_id)', 'Created index on integration_logs.external_api_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_integration_logs_company_id ON integration_logs(company_id)', 'Created index on integration_logs.company_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_integration_logs_request_started_at ON integration_logs(request_started_at DESC)', 'Created index on integration_logs.request_started_at');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_integration_logs_correlation_id ON integration_logs(correlation_id)', 'Created index on integration_logs.correlation_id');
    
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category)', 'Created index on system_configs.category');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key)', 'Created index on system_configs.config_key');

    await log('\nSeeding initial data...');
    
    // 5. Seed system configs
    await executeSQL(`
      INSERT INTO system_configs (config_key, config_value, value_type, description, category)
      VALUES
        ('tax.default_rate', '8', 'number', 'Thuế GTGT mặc định (%)', 'tax'),
        ('voucher.max_items', '100', 'number', 'Số lượng items tối đa trên voucher', 'voucher'),
        ('voucher.max_amount', '999999999999', 'number', 'Số tiền tối đa trên voucher', 'voucher'),
        ('ai.suggestion_ttl_hours', '72', 'number', 'Thời gian sống của AI suggestion (giờ)', 'ai'),
        ('ai.confidence_threshold', '80', 'number', 'Ngưỡng confidence để auto-apply (0-100)', 'ai'),
        ('inventory.low_stock_threshold', '10', 'number', 'Ngưỡng cảnh báo low stock', 'inventory'),
        ('closing.lock_days', '30', 'number', 'Số ngày khóa sổ tự động sau khi kết thúc kỳ', 'closing'),
        ('session.timeout_minutes', '120', 'number', 'Session timeout (phút)', 'security'),
        ('rate_limit.max_requests', '100', 'number', 'Số requests tối đa trong rate limit window', 'security'),
        ('rate_limit.window_seconds', '60', 'number', 'Rate limit window (giây)', 'security')
      ON CONFLICT (config_key) DO NOTHING
    `, 'Seeded system configs');

    // 6. Seed external APIs
    await executeSQL(`
      INSERT INTO external_apis (name, service_type, description, base_url, auth_type, config, is_active)
      VALUES
        ('Casso Banking', 'casso', 'Casso Open Banking Integration', 'https://api.casso.vn', 'bearer', '{"sync_interval_minutes": 5, "webhook_enabled": true}', true),
        ('eInvoice Tax Authority', 'einvoice', 'eInvoice Tax Authority Integration', 'https://api.einvoice.gov.vn', 'bearer', '{"auto_send": false, "require_approval": true}', true),
        ('Gemini AI', 'gemini', 'Google Gemini AI Service', 'https://generativelanguage.googleapis.com', 'api_key', '{"model": "gemini-pro", "temperature": 0.7}', true)
      ON CONFLICT DO NOTHING
    `, 'Seeded external APIs');

    await log('\nCreating triggers...');
    
    // 7. Create triggers for updated_at
    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_external_apis_updated_at()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql
    `, 'Created update_external_apis_updated_at function');

    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_external_apis_updated_at ON external_apis;
      CREATE TRIGGER trigger_external_apis_updated_at
        BEFORE UPDATE ON external_apis
        FOR EACH ROW
        EXECUTE FUNCTION update_external_apis_updated_at()
    `, 'Created external_apis updated_at trigger');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_system_configs_updated_at()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql
    `, 'Created update_system_configs_updated_at function');

    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_system_configs_updated_at ON system_configs;
      CREATE TRIGGER trigger_system_configs_updated_at
        BEFORE UPDATE ON system_configs
        FOR EACH ROW
        EXECUTE FUNCTION update_system_configs_updated_at()
    `, 'Created system_configs updated_at trigger');

    await log('\nEnabling Row Level Security...');
    
    // 8. Enable RLS
    await executeSQL('ALTER TABLE external_apis ENABLE ROW LEVEL SECURITY', 'Enabled RLS on external_apis');
    await executeSQL('ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY', 'Enabled RLS on integration_logs');
    await executeSQL('ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY', 'Enabled RLS on system_configs');

    // 9. Create RLS policies
    await executeSQL(`
      CREATE POLICY external_apis_company_isolation ON external_apis
        FOR ALL
        USING (company_id = current_setting('app.current_company_id', true)::INTEGER OR company_id IS NULL)
    `, 'Created RLS policy on external_apis');

    await executeSQL(`
      CREATE POLICY integration_logs_company_isolation ON integration_logs
        FOR ALL
        USING (company_id = current_setting('app.current_company_id', true)::INTEGER)
    `, 'Created RLS policy on integration_logs');

    await executeSQL(`
      CREATE POLICY system_configs_read_all ON system_configs
        FOR SELECT
        USING (true)
    `, 'Created RLS policy on system_configs');

    await log('\nCreating helper functions...');
    
    // 10. Create helper functions
    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_system_config(p_config_key VARCHAR(100))
      RETURNS TEXT AS $FUNC_BODY$
      DECLARE
        v_config_value TEXT;
      BEGIN
        SELECT config_value INTO v_config_value
        FROM system_configs
        WHERE config_key = p_config_key;
        
        IF NOT FOUND THEN
          RETURN NULL;
        END IF;
        
        RETURN v_config_value;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created get_system_config function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_system_config_typed(p_config_key VARCHAR(100), p_default_value TEXT DEFAULT NULL)
      RETURNS TEXT AS $FUNC_BODY$
      DECLARE
        v_config_value TEXT;
      BEGIN
        SELECT config_value INTO v_config_value
        FROM system_configs
        WHERE config_key = p_config_key;
        
        IF NOT FOUND THEN
          RETURN p_default_value;
        END IF;
        
        RETURN v_config_value;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created get_system_config_typed function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION cleanup_old_integration_logs()
      RETURNS INTEGER AS $FUNC_BODY$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM integration_logs
        WHERE request_started_at < NOW() - INTERVAL '90 days';
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created cleanup_old_integration_logs function');

    await log('\n✅ Migration completed successfully!', 'success');
    await log('\n📋 What was created:', 'info');
    await log('   1. external_apis table - Flexible API configuration');
    await log('   2. integration_logs table - Audit trail for API calls');
    await log('   3. system_configs table - Database-driven configuration');
    await log('   4. Indexes for performance');
    await log('   5. RLS policies for security');
    await log('   6. Helper functions for config management');
    await log('   7. Seed data for existing integrations');
    await log('\n🌐 External API Registry is ready!', 'success');
    await log('\nNext steps:', 'info');
    await log('   1. Update services to use external_apis table');
    await log('   2. Replace hard-coded values with get_system_config()');
    await log('   3. Add integration logging to all external API calls');
    await log('   4. Proceed to Phase 3: AI Sandbox Worker');
    await log('\n' + '='.repeat(60));

  } catch (error) {
    await log(`\n❌ Migration failed: ${error.message}`, 'error');
    console.error('Full error:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Run migration
migrate();