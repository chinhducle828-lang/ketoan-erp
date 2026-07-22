/**
 * Phase 1: Enforce Event Store Immutability Migration
 * ====================================================
 * Adds triggers and functions to prevent UPDATE/DELETE on event_store
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
  await log('🔒 Phase 1: Enforce Event Store Immutability\n');
  await log('='.repeat(60));

  try {
    await log('Creating trigger function: prevent_event_store_modification()');
    
    // 1. Create trigger function
    await executeSQL(`
      CREATE OR REPLACE FUNCTION prevent_event_store_modification()
      RETURNS TRIGGER AS $TRIGGER_BODY$
      DECLARE
        v_event_id TEXT;
      BEGIN
        v_event_id := OLD.id::TEXT;
        
        IF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot UPDATE event_store. Event ID % is immutable. Use compensation events instead.', v_event_id;
        ELSIF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot DELETE from event_store. Event ID % is immutable. Use compensation events instead.', v_event_id;
        END IF;
        RETURN NULL;
      END;
      $TRIGGER_BODY$ LANGUAGE plpgsql;
    `, 'Created prevent_event_store_modification() function');

    await log('\nCreating function: compensate_event()');
    
    // 2. Create compensation function
    await executeSQL(`
      CREATE OR REPLACE FUNCTION compensate_event(
        p_original_event_id BIGINT,
        p_event_type VARCHAR(100),
        p_event_data JSONB,
        p_reason TEXT DEFAULT 'Correction'
      )
      RETURNS BIGINT AS $FUNC_BODY$
      DECLARE
        v_original_event RECORD;
        v_new_event_id BIGINT;
        v_correlation_id VARCHAR(100);
      BEGIN
        SELECT * INTO v_original_event FROM event_store WHERE id = p_original_event_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'COMPENSATION_ERROR: Original event ID % not found', p_original_event_id;
        END IF;
        
        v_correlation_id := 'compensate_' || p_original_event_id::text || '_' || extract(epoch from now())::text;
        
        INSERT INTO event_store (
          event_type, category, company_id, user_id, event_data, metadata, severity, correlation_id, version
        ) VALUES (
          p_event_type,
          v_original_event.category,
          v_original_event.company_id,
          NULL,
          p_event_data,
          jsonb_build_object(
            'original_event_id', p_original_event_id,
            'original_event_type', v_original_event.event_type,
            'original_timestamp', v_original_event.timestamp,
            'reason', p_reason,
            'compensation', true
          ),
          'warning',
          v_correlation_id,
          v_original_event.version
        ) RETURNING id INTO v_new_event_id;
        
        RETURN v_new_event_id;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql;
    `, 'Created compensate_event() function');

    await log('\nCreating function: get_event_compensation_chain()');
    
    // 3. Create helper function
    await executeSQL(`
      CREATE OR REPLACE FUNCTION get_event_compensation_chain(p_event_id BIGINT)
      RETURNS TABLE (
        event_id BIGINT, event_type VARCHAR(100), event_timestamp TIMESTAMP,
        is_compensation BOOLEAN, compensation_reason TEXT, original_event_id BIGINT
      ) AS $FUNC_BODY$
      BEGIN
        RETURN QUERY
        WITH RECURSIVE event_chain AS (
          SELECT e.id, e.event_type, e.timestamp, false as is_compensation,
                 NULL::TEXT as compensation_reason, e.id as original_event_id
          FROM event_store e WHERE e.id = p_event_id
          UNION ALL
          SELECT e.id, e.event_type, e.timestamp, true as is_compensation,
                 (e.metadata->>'reason')::TEXT as compensation_reason,
                 (e.metadata->>'original_event_id')::BIGINT as original_event_id
          FROM event_store e
          INNER JOIN event_chain ec ON (e.metadata->>'original_event_id')::BIGINT = ec.id
        )
        SELECT ec.id, ec.event_type, ec.timestamp, ec.is_compensation, ec.compensation_reason, ec.original_event_id
        FROM event_chain ec ORDER BY ec.timestamp ASC;
      END;
      $FUNC_BODY$ LANGUAGE plpgsql;
    `, 'Created get_event_compensation_chain() function');

    await log('\nCreating triggers on event_store');
    
    // 4. Create UPDATE trigger
    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_prevent_event_store_update ON event_store;
      CREATE TRIGGER trigger_prevent_event_store_update
        BEFORE UPDATE ON event_store
        FOR EACH ROW
        EXECUTE FUNCTION prevent_event_store_modification();
    `, 'Created UPDATE trigger');

    // 5. Create DELETE trigger
    await executeSQL(`
      DROP TRIGGER IF EXISTS trigger_prevent_event_store_delete ON event_store;
      CREATE TRIGGER trigger_prevent_event_store_delete
        BEFORE DELETE ON event_store
        FOR EACH ROW
        EXECUTE FUNCTION prevent_event_store_modification();
    `, 'Created DELETE trigger');

    await log('\nGranting permissions');
    
    // 6. Grant permissions (optional - role may not exist yet)
    try {
      await executeSQL(
        `GRANT EXECUTE ON FUNCTION compensate_event(BIGINT, VARCHAR(100), JSONB, TEXT) TO ketoan_app;`,
        'Granted compensate_event() permission'
      );
      
      await executeSQL(
        `GRANT EXECUTE ON FUNCTION get_event_compensation_chain(BIGINT) TO ketoan_app;`,
        'Granted get_event_compensation_chain() permission'
      );
    } catch (err) {
      await log('   ⚠️ Permission grants skipped (role ketoan_app not found - will be created during deployment)', 'warning');
    }

    await log('\n✅ Migration completed successfully!', 'success');
    await log('\n📋 What was created:', 'info');
    await log('   1. prevent_event_store_modification() - Trigger function');
    await log('   2. compensate_event() - Compensation event function');
    await log('   3. get_event_compensation_chain() - Helper function');
    await log('   4. 2 triggers on event_store (UPDATE + DELETE)');
    await log('\n🔒 Event Store is now immutable!', 'success');
    await log('\nNext steps:', 'info');
    await log('   1. Run test: node scripts/test_immutability_enforcement.js');
    await log('   2. Update eventStore.service.js to use compensation');
    await log('   3. Proceed to Phase 2: External API Registry');
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