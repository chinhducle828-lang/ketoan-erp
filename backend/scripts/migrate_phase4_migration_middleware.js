/**
 * Phase 4: Migration Middleware - Unified Audit Logging
 * =====================================================
 * Creates unified audit logging system
 * Automatically logs all operations to event_store
 */

import { pool } from '../config/db.js';

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
  await log('🔔 Phase 4: Migration Middleware - Unified Audit Logging\n');
  await log('='.repeat(60));

  try {
    await log('Creating table: audit_middleware_config');
    
    // 1. Create audit_middleware_config table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS audit_middleware_config (
        id BIGSERIAL PRIMARY KEY,
        route_pattern VARCHAR(200) NOT NULL,
        method VARCHAR(10) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        log_request_body BOOLEAN NOT NULL DEFAULT false,
        log_response_body BOOLEAN NOT NULL DEFAULT false,
        log_headers BOOLEAN NOT NULL DEFAULT false,
        exclude_fields TEXT[],
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*')),
        CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
      )
    `, 'Created audit_middleware_config table');

    await log('\nCreating table: audit_log_summary');
    
    // 2. Create audit_log_summary table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS audit_log_summary (
        id BIGSERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        description TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        correlation_id VARCHAR(100),
        event_store_id BIGINT REFERENCES event_store(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical'))
      )
    `, 'Created audit_log_summary table');

    await log('\nCreating indexes...');
    
    // 3. Create indexes
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_middleware_config_route_pattern ON audit_middleware_config(route_pattern)', 'Created index on audit_middleware_config.route_pattern');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_middleware_config_is_active ON audit_middleware_config(is_active)', 'Created index on audit_middleware_config.is_active');
    
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_log_summary_company_id ON audit_log_summary(company_id)', 'Created index on audit_log_summary.company_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_log_summary_event_type ON audit_log_summary(event_type)', 'Created index on audit_log_summary.event_type');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_log_summary_created_at ON audit_log_summary(created_at DESC)', 'Created index on audit_log_summary.created_at');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_log_summary_resource ON audit_log_summary(resource_type, resource_id)', 'Created index on audit_log_summary.resource');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_audit_log_summary_company_created ON audit_log_summary(company_id, created_at DESC)', 'Created composite index on audit_log_summary');

    await log('\nCreating triggers...');
    
    // 4. Create triggers for updated_at
    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_audit_middleware_config_updated_at()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql
    `, 'Created update_audit_middleware_config_updated_at function');

    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_audit_middleware_config_updated_at ON audit_middleware_config;
      CREATE TRIGGER trigger_audit_middleware_config_updated_at
        BEFORE UPDATE ON audit_middleware_config
        FOR EACH ROW
        EXECUTE FUNCTION update_audit_middleware_config_updated_at()
    `, 'Created audit_middleware_config updated_at trigger');

    await log('\nEnabling Row Level Security...');
    
    // 5. Enable RLS
    await executeSQL('ALTER TABLE audit_middleware_config ENABLE ROW LEVEL SECURITY', 'Enabled RLS on audit_middleware_config');
    await executeSQL('ALTER TABLE audit_log_summary ENABLE ROW LEVEL SECURITY', 'Enabled RLS on audit_log_summary');

    // 6. Create RLS policies
    await executeSQL(`
      CREATE POLICY audit_middleware_config_read_all ON audit_middleware_config
        FOR SELECT
        USING (true)
    `, 'Created RLS policy on audit_middleware_config');

    await executeSQL(`
      CREATE POLICY audit_log_summary_company_isolation ON audit_log_summary
        FOR ALL
        USING (company_id = current_setting('app.current_company_id', true)::INTEGER)
    `, 'Created RLS policy on audit_log_summary');

    await log('\nCreating helper functions...');
    
    // 7. Create helper functions
    await executeSQL(`
      CREATE OR REPLACE FUNCTION create_audit_log(
        p_company_id INTEGER,
        p_event_type VARCHAR(100),
        p_category VARCHAR(50),
        p_severity VARCHAR(20),
        p_description TEXT,
        p_user_id INTEGER DEFAULT NULL,
        p_resource_type VARCHAR(50) DEFAULT NULL,
        p_resource_id INTEGER DEFAULT NULL,
        p_ip_address VARCHAR(45) DEFAULT NULL,
        p_user_agent TEXT DEFAULT NULL,
        p_correlation_id VARCHAR(100) DEFAULT NULL,
        p_event_data JSONB DEFAULT '{}'
      )
      RETURNS BIGINT AS $FUNC_BODY$
      DECLARE
        v_audit_log_id BIGINT;
        v_event_store_id BIGINT;
      BEGIN
        INSERT INTO event_store (
          event_type, category, company_id, user_id, event_data, severity, correlation_id
        ) VALUES (
          p_event_type, p_category, p_company_id, p_user_id, p_event_data, p_severity, p_correlation_id
        ) RETURNING id INTO v_event_store_id;
        
        INSERT INTO audit_log_summary (
          company_id, event_type, category, severity, user_id, resource_type, resource_id,
          description, ip_address, user_agent, correlation_id, event_store_id
        ) VALUES (
          p_company_id, p_event_type, p_category, p_severity, p_user_id, p_resource_type, p_resource_id,
          p_description, p_ip_address, p_user_agent, p_correlation_id, v_event_store_id
        ) RETURNING id INTO v_audit_log_id;
        
        RETURN v_audit_log_id;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created create_audit_log function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_audit_logs(
        p_company_id INTEGER DEFAULT NULL,
        p_event_type VARCHAR(100) DEFAULT NULL,
        p_category VARCHAR(50) DEFAULT NULL,
        p_severity VARCHAR(20) DEFAULT NULL,
        p_user_id INTEGER DEFAULT NULL,
        p_resource_type VARCHAR(50) DEFAULT NULL,
        p_resource_id INTEGER DEFAULT NULL,
        p_start_date TIMESTAMP DEFAULT NULL,
        p_end_date TIMESTAMP DEFAULT NULL,
        p_limit INTEGER DEFAULT 100,
        p_offset INTEGER DEFAULT 0
      )
      RETURNS TABLE (
        id BIGINT, event_type VARCHAR(100), category VARCHAR(50), severity VARCHAR(20),
        user_id INTEGER, resource_type VARCHAR(50), resource_id INTEGER,
        description TEXT, ip_address VARCHAR(45), user_agent TEXT,
        correlation_id VARCHAR(100), created_at TIMESTAMP
      ) AS $FUNC_BODY$
      BEGIN
        RETURN QUERY
        SELECT als.id, als.event_type, als.category, als.severity, als.user_id,
               als.resource_type, als.resource_id, als.description, als.ip_address,
               als.user_agent, als.correlation_id, als.created_at
        FROM audit_log_summary als
        WHERE (p_company_id IS NULL OR als.company_id = p_company_id)
          AND (p_event_type IS NULL OR als.event_type = p_event_type)
          AND (p_category IS NULL OR als.category = p_category)
          AND (p_severity IS NULL OR als.severity = p_severity)
          AND (p_user_id IS NULL OR als.user_id = p_user_id)
          AND (p_resource_type IS NULL OR als.resource_type = p_resource_type)
          AND (p_resource_id IS NULL OR als.resource_id = p_resource_id)
          AND (p_start_date IS NULL OR als.created_at >= p_start_date)
          AND (p_end_date IS NULL OR als.created_at < p_end_date)
        ORDER BY als.created_at DESC
        LIMIT p_limit OFFSET p_offset;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created get_audit_logs function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
      RETURNS INTEGER AS $FUNC_BODY$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM audit_log_summary
        WHERE created_at < NOW() - INTERVAL '2 years';
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created cleanup_old_audit_logs function');

    await log('\nSeeding initial config...');
    
    // 8. Seed initial config
    await executeSQL(`
      INSERT INTO audit_middleware_config (route_pattern, method, event_type, category, severity, log_request_body, log_response_body)
      VALUES
        ('/api/vouchers', 'POST', 'VOUCHER_CREATED', 'voucher', 'info', true, false),
        ('/api/vouchers/*', 'PUT', 'VOUCHER_UPDATED', 'voucher', 'info', true, false),
        ('/api/vouchers/*', 'DELETE', 'VOUCHER_DELETED', 'voucher', 'warning', false, false),
        ('/api/vouchers/*/post', 'POST', 'VOUCHER_POSTED', 'accounting', 'info', true, false),
        ('/api/partners', 'POST', 'PARTNER_CREATED', 'partner', 'info', true, false),
        ('/api/partners/*', 'PUT', 'PARTNER_UPDATED', 'partner', 'info', true, false),
        ('/api/items', 'POST', 'ITEM_CREATED', 'inventory', 'info', true, false),
        ('/api/items/*', 'PUT', 'ITEM_UPDATED', 'inventory', 'info', true, false),
        ('/api/users/*/login', 'POST', 'USER_LOGIN', 'user', 'info', false, false),
        ('/api/users/*/logout', 'POST', 'USER_LOGOUT', 'user', 'info', false, false),
        ('/api/ai/suggestions/*/approve', 'POST', 'AI_SUGGESTION_APPROVED', 'ai', 'info', false, false),
        ('/api/ai/suggestions/*/reject', 'POST', 'AI_SUGGESTION_REJECTED', 'ai', 'info', false, false),
        ('/api/closing/*', 'POST', 'CLOSING_EXECUTED', 'accounting', 'warning', true, false)
      ON CONFLICT DO NOTHING
    `, 'Seeded audit middleware config');

    await log('\n✅ Migration completed successfully!', 'success');
    await log('\n📋 What was created:', 'info');
    await log('   1. audit_middleware_config table - Configuration for audit logging');
    await log('   2. audit_log_summary table - Quick query table for audit logs');
    await log('   3. Indexes for performance');
    await log('   4. RLS policies for security');
    await log('   5. Helper functions for unified audit logging');
    await log('   6. Seed data for common routes');
    await log('\n🔔 Migration Middleware is ready!', 'success');
    await log('\nNext steps:', 'info');
    await log('   1. Create unified audit middleware');
    await log('   2. Integrate with existing routes');
    await log('   3. Test audit logging across the system');
    await log('   4. All phases complete!');
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