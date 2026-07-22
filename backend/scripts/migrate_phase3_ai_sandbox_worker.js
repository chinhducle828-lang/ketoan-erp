/**
 * Phase 3: AI Sandbox Worker Migration
 * =====================================
 * Creates tables for AI monitoring and anomaly detection
 * Tracks AI performance metrics and detects discrepancies
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
  await log('🤖 Phase 3: AI Sandbox Worker\n');
  await log('='.repeat(60));

  try {
    await log('Creating table: anomaly_reports');
    
    // 1. Create anomaly_reports table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS anomaly_reports (
        id BIGSERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        anomaly_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'warning',
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        event_id BIGINT REFERENCES event_store(id) ON DELETE SET NULL,
        ai_suggestion_id BIGINT REFERENCES ai_suggestions(id) ON DELETE SET NULL,
        voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
        detection_method VARCHAR(50) NOT NULL,
        detection_data JSONB NOT NULL DEFAULT '{}',
        confidence_score INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        is_false_positive BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolution_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_anomaly_type CHECK (anomaly_type IN ('ai_suggestion_mismatch', 'unusual_transaction_amount', 'duplicate_entry', 'missing_required_field', 'incorrect_account_code', 'tax_calculation_error', 'currency_mismatch', 'timing_anomaly', 'pattern_deviation')),
        CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        CONSTRAINT valid_status CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed'))
      )
    `, 'Created anomaly_reports table');

    await log('\nCreating table: ai_monitoring_metrics');
    
    // 2. Create ai_monitoring_metrics table
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS ai_monitoring_metrics (
        id BIGSERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        metric_date DATE NOT NULL,
        metric_hour INTEGER,
        total_suggestions INTEGER NOT NULL DEFAULT 0,
        applied_suggestions INTEGER NOT NULL DEFAULT 0,
        rejected_suggestions INTEGER NOT NULL DEFAULT 0,
        expired_suggestions INTEGER NOT NULL DEFAULT 0,
        correct_suggestions INTEGER NOT NULL DEFAULT 0,
        incorrect_suggestions INTEGER NOT NULL DEFAULT 0,
        accuracy_rate DECIMAL(5,2),
        anomalies_detected INTEGER NOT NULL DEFAULT 0,
        false_positives INTEGER NOT NULL DEFAULT 0,
        true_positives INTEGER NOT NULL DEFAULT 0,
        avg_processing_time_ms INTEGER,
        avg_confidence_score DECIMAL(5,2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_accuracy_rate CHECK (accuracy_rate >= 0 AND accuracy_rate <= 100),
        CONSTRAINT unique_company_date_hour UNIQUE (company_id, metric_date, metric_hour)
      )
    `, 'Created ai_monitoring_metrics table');

    await log('\nCreating indexes...');
    
    // 3. Create indexes
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_company_id ON anomaly_reports(company_id)', 'Created index on anomaly_reports.company_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_anomaly_type ON anomaly_reports(anomaly_type)', 'Created index on anomaly_reports.anomaly_type');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_severity ON anomaly_reports(severity)', 'Created index on anomaly_reports.severity');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_status ON anomaly_reports(status)', 'Created index on anomaly_reports.status');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_created_at ON anomaly_reports(created_at DESC)', 'Created index on anomaly_reports.created_at');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_event_id ON anomaly_reports(event_id)', 'Created index on anomaly_reports.event_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_ai_suggestion_id ON anomaly_reports(ai_suggestion_id)', 'Created index on anomaly_reports.ai_suggestion_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_anomaly_reports_detection_data_gin ON anomaly_reports USING GIN(detection_data)', 'Created GIN index on anomaly_reports.detection_data');
    
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_company_id ON ai_monitoring_metrics(company_id)', 'Created index on ai_monitoring_metrics.company_id');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_metric_date ON ai_monitoring_metrics(metric_date DESC)', 'Created index on ai_monitoring_metrics.metric_date');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_company_date ON ai_monitoring_metrics(company_id, metric_date DESC)', 'Created composite index on ai_monitoring_metrics');

    await log('\nCreating triggers...');
    
    // 4. Create triggers for updated_at
    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_anomaly_reports_updated_at()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql
    `, 'Created update_anomaly_reports_updated_at function');

    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_anomaly_reports_updated_at ON anomaly_reports;
      CREATE TRIGGER trigger_anomaly_reports_updated_at
        BEFORE UPDATE ON anomaly_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_anomaly_reports_updated_at()
    `, 'Created anomaly_reports updated_at trigger');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_ai_monitoring_metrics_updated_at()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql
    `, 'Created update_ai_monitoring_metrics_updated_at function');

    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_ai_monitoring_metrics_updated_at ON ai_monitoring_metrics;
      CREATE TRIGGER trigger_ai_monitoring_metrics_updated_at
        BEFORE UPDATE ON ai_monitoring_metrics
        FOR EACH ROW
        EXECUTE FUNCTION update_ai_monitoring_metrics_updated_at()
    `, 'Created ai_monitoring_metrics updated_at trigger');

    await log('\nEnabling Row Level Security...');
    
    // 5. Enable RLS
    await executeSQL('ALTER TABLE anomaly_reports ENABLE ROW LEVEL SECURITY', 'Enabled RLS on anomaly_reports');
    await executeSQL('ALTER TABLE ai_monitoring_metrics ENABLE ROW LEVEL SECURITY', 'Enabled RLS on ai_monitoring_metrics');

    // 6. Create RLS policies
    await executeSQL(`
      CREATE POLICY anomaly_reports_company_isolation ON anomaly_reports
        FOR ALL
        USING (company_id = current_setting('app.current_company_id', true)::INTEGER)
    `, 'Created RLS policy on anomaly_reports');

    await executeSQL(`
      CREATE POLICY ai_monitoring_metrics_company_isolation ON ai_monitoring_metrics
        FOR ALL
        USING (company_id = current_setting('app.current_company_id', true)::INTEGER)
    `, 'Created RLS policy on ai_monitoring_metrics');

    await log('\nCreating helper functions...');
    
    // 7. Create helper functions
    await executeSQL(`
      CREATE OR REPLACE FUNCTION create_anomaly_report(
        p_company_id INTEGER,
        p_anomaly_type VARCHAR(50),
        p_severity VARCHAR(20),
        p_title VARCHAR(200),
        p_description TEXT,
        p_detection_method VARCHAR(50),
        p_detection_data JSONB DEFAULT '{}',
        p_event_id BIGINT DEFAULT NULL,
        p_ai_suggestion_id BIGINT DEFAULT NULL,
        p_voucher_id INTEGER DEFAULT NULL,
        p_confidence_score INTEGER DEFAULT NULL
      )
      RETURNS BIGINT AS $FUNC_BODY$
      DECLARE
        v_anomaly_id BIGINT;
      BEGIN
        INSERT INTO anomaly_reports (
          company_id, anomaly_type, severity, title, description,
          event_id, ai_suggestion_id, voucher_id,
          detection_method, detection_data, confidence_score
        ) VALUES (
          p_company_id, p_anomaly_type, p_severity, p_title, p_description,
          p_event_id, p_ai_suggestion_id, p_voucher_id,
          p_detection_method, p_detection_data, p_confidence_score
        ) RETURNING id INTO v_anomaly_id;
        
        RETURN v_anomaly_id;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created create_anomaly_report function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION update_ai_monitoring_metrics(
        p_company_id INTEGER,
        p_metric_date DATE,
        p_metric_hour INTEGER,
        p_suggestions_added INTEGER DEFAULT 0,
        p_applied INTEGER DEFAULT 0,
        p_rejected INTEGER DEFAULT 0,
        p_expired INTEGER DEFAULT 0,
        p_correct INTEGER DEFAULT 0,
        p_incorrect INTEGER DEFAULT 0,
        p_anomalies INTEGER DEFAULT 0,
        p_false_positives INTEGER DEFAULT 0,
        p_true_positives INTEGER DEFAULT 0,
        p_processing_time_ms INTEGER DEFAULT NULL,
        p_confidence_score INTEGER DEFAULT NULL
      )
      RETURNS VOID AS $FUNC_BODY$
      BEGIN
        INSERT INTO ai_monitoring_metrics (
          company_id, metric_date, metric_hour,
          total_suggestions, applied_suggestions, rejected_suggestions, expired_suggestions,
          correct_suggestions, incorrect_suggestions,
          anomalies_detected, false_positives, true_positives,
          avg_processing_time_ms, avg_confidence_score
        ) VALUES (
          p_company_id, p_metric_date, p_metric_hour,
          p_suggestions_added, p_applied, p_rejected, p_expired,
          p_correct, p_incorrect,
          p_anomalies, p_false_positives, p_true_positives,
          p_processing_time_ms, p_confidence_score
        )
        ON CONFLICT (company_id, metric_date, metric_hour) 
        DO UPDATE SET
          total_suggestions = ai_monitoring_metrics.total_suggestions + p_suggestions_added,
          applied_suggestions = ai_monitoring_metrics.applied_suggestions + p_applied,
          rejected_suggestions = ai_monitoring_metrics.rejected_suggestions + p_rejected,
          expired_suggestions = ai_monitoring_metrics.expired_suggestions + p_expired,
          correct_suggestions = ai_monitoring_metrics.correct_suggestions + p_correct,
          incorrect_suggestions = ai_monitoring_metrics.incorrect_suggestions + p_incorrect,
          anomalies_detected = ai_monitoring_metrics.anomalies_detected + p_anomalies,
          false_positives = ai_monitoring_metrics.false_positives + p_false_positives,
          true_positives = ai_monitoring_metrics.true_positives + p_true_positives,
          avg_processing_time_ms = COALESCE(p_processing_time_ms, ai_monitoring_metrics.avg_processing_time_ms),
          avg_confidence_score = COALESCE(p_confidence_score, ai_monitoring_metrics.avg_confidence_score),
          updated_at = NOW();
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created update_ai_monitoring_metrics function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_anomaly_statistics(
        p_company_id INTEGER,
        p_start_date DATE DEFAULT NULL,
        p_end_date DATE DEFAULT NULL
      )
      RETURNS TABLE (
        total_anomalies BIGINT,
        open_anomalies BIGINT,
        resolved_anomalies BIGINT,
        false_positives BIGINT,
        critical_count BIGINT,
        error_count BIGINT,
        warning_count BIGINT,
        info_count BIGINT
      ) AS $FUNC_BODY$
      BEGIN
        p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
        p_end_date := COALESCE(p_end_date, CURRENT_DATE);
        
        RETURN QUERY
        SELECT 
          COUNT(*)::BIGINT,
          COUNT(*) FILTER (WHERE status = 'open')::BIGINT,
          COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT,
          COUNT(*) FILTER (WHERE is_false_positive = true)::BIGINT,
          COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT,
          COUNT(*) FILTER (WHERE severity = 'error')::BIGINT,
          COUNT(*) FILTER (WHERE severity = 'warning')::BIGINT,
          COUNT(*) FILTER (WHERE severity = 'info')::BIGINT
        FROM anomaly_reports
        WHERE company_id = p_company_id
          AND created_at >= p_start_date
          AND created_at < p_end_date + INTERVAL '1 day';
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created get_anomaly_statistics function');

    await executeSQL(`
      CREATE OR REPLACE FUNCTION cleanup_old_ai_metrics()
      RETURNS INTEGER AS $FUNC_BODY$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM ai_monitoring_metrics
        WHERE metric_date < CURRENT_DATE - INTERVAL '1 year';
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql
    `, 'Created cleanup_old_ai_metrics function');

    await log('\n✅ Migration completed successfully!', 'success');
    await log('\n📋 What was created:', 'info');
    await log('   1. anomaly_reports table - Store detected anomalies');
    await log('   2. ai_monitoring_metrics table - Track AI performance');
    await log('   3. Indexes for performance');
    await log('   4. RLS policies for security');
    await log('   5. Helper functions for anomaly detection and metrics');
    await log('\n🤖 AI Sandbox Worker is ready!', 'success');
    await log('\nNext steps:', 'info');
    await log('   1. Create background worker service');
    await log('   2. Implement anomaly detection logic');
    await log('   3. Add metrics collection to AI pipeline');
    await log('   4. Proceed to Phase 4: Migration Middleware');
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