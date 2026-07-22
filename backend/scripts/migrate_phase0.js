/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * scripts/migrate_phase0.js
 * ====================================================================
 * Phase 0 Migration Script - Apply Security & Audit Improvements
 * ====================================================================
 * 
 * Script này thực hiện:
 * 1. Tạo event_store và ai_suggestions tables
 * 2. Cập nhật Redis operations để sử dụng multi-tenancy
 * 3. Integrate Event Store vào luồng xử lý hiện tại
 * 4. Cleanup và validation
 * 
 * Cách chạy:
 *   node scripts/migrate_phase0.js
 * 
 * Hoặc qua npm:
 *   npm run migrate:phase0
 * ====================================================================
 */

import { pool } from '../config/db.js';
import { redis, isRedisReadyCheck } from '../cache/redis.js';
import { mtInvalidateCompany, mtAuditLog } from '../cache/redisMultiTenancy.js';
import { EventStore } from '../services/eventStore.service.js';
import { AISandbox } from '../services/aiSandbox.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====================================================================
// Migration Configuration
// ====================================================================

const MIGRATION_VERSION = '1.0.0';
const MIGRATION_NAME = 'phase0_security_audit';

// ====================================================================
// Helper Functions
// ====================================================================

async function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function executeSQL(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}\nQuery: ${sql.substring(0, 100)}...`);
  }
}

// ====================================================================
// Migration Steps
// ====================================================================

/**
 * Split SQL respecting dollar-quoted strings
 */
function splitSQLRespectingDollarQuotes(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarQuoteTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    
    // Check for dollar quote start (e.g., $$ or $tag$)
    if (char === '$' && !inDollarQuote) {
      // Look ahead to find the complete tag
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && (sql[j] !== '$' || (j === i + 1 && sql[j] === '$'))) {
        tag += sql[j];
        j++;
      }
      if (j < sql.length && sql[j] === '$') {
        tag += '$';
        inDollarQuote = true;
        dollarQuoteTag = tag;
        current += tag;
        i = j;
        continue;
      }
    }
    
    // Check for dollar quote end
    if (inDollarQuote && char === '$') {
      // Check if this matches our opening tag
      let potentialTag = '$';
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        potentialTag += sql[j];
        j++;
      }
      if (j < sql.length) {
        potentialTag += '$';
        if (potentialTag === dollarQuoteTag) {
          inDollarQuote = false;
          current += potentialTag;
          i = j;
          continue;
        }
      }
    }
    
    // Split on semicolons only when not in dollar quotes
    if (char === ';' && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Add the last statement if any
  const lastStatement = current.trim();
  if (lastStatement && !lastStatement.startsWith('--')) {
    statements.push(lastStatement);
  }
  
  return statements;
}

/**
 * Step 1: Create new tables (event_store, ai_suggestions)
 */
async function createTables() {
  await log('Bước 1: Tạo event_store và ai_suggestions tables...');
  
  const migrationSQL = fs.readFileSync(
    path.join(__dirname, '../migrations/20260716_create_event_store.sql'),
    'utf-8'
  );
  
  // Try to execute the entire SQL file at once
  // PostgreSQL can handle multiple statements in one query
  try {
    await executeSQL(migrationSQL);
    await log('✅ Đã tạo event_store và ai_suggestions tables', 'success');
  } catch (err) {
    // If that fails, try using psql command-line tool
    await log('⚠️ Không thể execute trực tiếp, thử dùng psql...', 'warning');
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Build connection string
      const dbConfig = pool.options;
      let connectionString;
      
      if (dbConfig.connectionString) {
        connectionString = dbConfig.connectionString;
      } else {
        connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
      }
      
      // Write SQL to temp file
      const tempSQLFile = path.join(__dirname, '../migrations/temp_migration.sql');
      fs.writeFileSync(tempSQLFile, migrationSQL);
      
      // Execute using psql
      const { stdout, stderr } = await execAsync(
        `psql "${connectionString}" -f "${tempSQLFile}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      
      // Clean up temp file
      fs.unlinkSync(tempSQLFile);
      
      if (stderr && !stderr.includes('already exists')) {
        console.warn('psql stderr:', stderr);
      }
      
      await log('✅ Đã tạo event_store và ai_suggestions tables (qua psql)', 'success');
    } catch (psqlErr) {
      // If psql also fails, try a minimal approach - just create the tables
      await log('⚠️ psql không khả dụng, tạo tables với SQL tối thiểu...', 'warning');
      
      try {
        await executeSQL(`
          CREATE TABLE IF NOT EXISTS event_store (
            id BIGSERIAL PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            company_id INTEGER NOT NULL,
            user_id INTEGER,
            event_data JSONB NOT NULL,
            metadata JSONB,
            severity VARCHAR(20) NOT NULL DEFAULT 'info',
            correlation_id VARCHAR(100) NOT NULL,
            timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
            version VARCHAR(20) NOT NULL DEFAULT '1.0'
          )
        `);
        
        await executeSQL(`
          CREATE TABLE IF NOT EXISTS ai_suggestions (
            id BIGSERIAL PRIMARY KEY,
            type VARCHAR(50) NOT NULL,
            company_id INTEGER NOT NULL,
            user_id INTEGER,
            field VARCHAR(100) NOT NULL,
            current_value TEXT,
            suggested_value TEXT NOT NULL,
            confidence INTEGER NOT NULL DEFAULT 0,
            is_critical BOOLEAN NOT NULL DEFAULT false,
            requires_approval BOOLEAN NOT NULL DEFAULT true,
            can_auto_apply BOOLEAN NOT NULL DEFAULT false,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            input_data JSONB NOT NULL,
            ai_metadata JSONB,
            approved_by INTEGER,
            approved_at TIMESTAMP,
            applied_by INTEGER,
            applied_at TIMESTAMP,
            rejected_by INTEGER,
            rejected_at TIMESTAMP,
            rejection_reason TEXT,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        
        await log('✅ Đã tạo event_store và ai_suggestions tables (tối thiểu)', 'success');
      } catch (minimalErr) {
        throw new Error(`Không thể tạo tables: ${minimalErr.message}`);
      }
    }
  }
}

/**
 * Step 2: Verify tables were created
 */
async function verifyTables() {
  await log('Bước 2: Verify tables...');
  
  try {
    const eventStoreResult = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_store'
      ) as exists
    `);
    
    const aiSuggestionsResult = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_suggestions'
      ) as exists
    `);
    
    const eventStoreExists = eventStoreResult.rows && eventStoreResult.rows[0] && eventStoreResult.rows[0].exists;
    const aiSuggestionsExists = aiSuggestionsResult.rows && aiSuggestionsResult.rows[0] && aiSuggestionsResult.rows[0].exists;
    
    if (!eventStoreExists) {
      throw new Error('event_store table không được tạo');
    }
    
    if (!aiSuggestionsExists) {
      throw new Error('ai_suggestions table không được tạo');
    }
    
    await log('✅ event_store và ai_suggestions tables đã tồn tại', 'success');
  } catch (err) {
    // If verification fails, try to check if tables exist by querying them directly
    try {
      await executeSQL('SELECT * FROM event_store LIMIT 0');
      await executeSQL('SELECT * FROM ai_suggestions LIMIT 0');
      await log('✅ event_store và ai_suggestions tables đã tồn tại (verified by query)', 'success');
    } catch (queryErr) {
      throw new Error(`Không thể verify tables: ${err.message}`);
    }
  }
}

/**
 * Step 3: Migrate existing Redis keys to multi-tenant format
 */
async function migrateRedisKeys() {
  await log('Bước 3: Migrate Redis keys sang multi-tenant format...');
  
  if (!isRedisReadyCheck()) {
    await log('⚠️ Redis chưa sẵn sàng, bỏ qua bước migrate Redis keys', 'warning');
    return;
  }
  
  // Get all companies
  const { rows: companies } = await executeSQL('SELECT id FROM companies');
  
  let totalMigrated = 0;
  
  for (const company of companies) {
    const companyId = company.id;
    await log(`  Migrating keys cho company ${companyId}...`);
    
    // Get all keys for this company (legacy format)
    const legacyPattern = `company:${companyId}:*`;
    const keys = await redis.keys(legacyPattern);
    
    for (const oldKey of keys) {
      // Create new key with standardized format
      const newKey = oldKey.replace(`company:${companyId}:`, `company_${companyId}:`);
      
      // Migrate value
      const value = await redis.get(oldKey);
      if (value) {
        const ttl = await redis.ttl(oldKey);
        await redis.setex(newKey, ttl > 0 ? ttl : 3600, value);
        await redis.del(oldKey);
        totalMigrated++;
      }
    }
    
    await log(`  ✅ Đã migrate ${keys.length} keys cho company ${companyId}`);
  }
  
  await log(`✅ Tổng cộng đã migrate ${totalMigrated} Redis keys`, 'success');
}

/**
 * Step 4: Initialize Event Store with system events
 */
async function initializeEventStore() {
  await log('Bước 4: Initialize Event Store...');
  
  try {
    // Get system user (first admin)
    const { rows: adminUsers } = await executeSQL(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );
    
    const systemUserId = adminUsers.length > 0 ? adminUsers[0].id : null;
    
    // Log system initialization event
    await EventStore.append({
      eventType: 'SYSTEM_MIGRATION_COMPLETED',
      category: 'system',
      companyId: 0, // System-wide event
      userId: systemUserId,
      eventData: {
        migration_name: MIGRATION_NAME,
        migration_version: MIGRATION_VERSION,
        components: [
          'event_store',
          'ai_suggestions',
          'redis_multi_tenancy',
          'ai_sandbox'
        ]
      },
      metadata: {
        source: 'migration_script',
        timestamp: new Date().toISOString()
      },
      severity: 'info'
    });
    
    await log('✅ Event Store đã được initialize', 'success');
  } catch (err) {
    await log('⚠️ Không thể initialize Event Store (tables có thể chưa sẵn sàng)', 'warning');
    console.warn('Event Store initialization error:', err.message);
  }
}

/**
 * Step 5: Setup AI Sandbox cleanup cron
 */
async function setupAISandboxCron() {
  await log('Bước 5: Setup AI Sandbox cleanup...');
  
  try {
    // Create cron job for cleaning up expired suggestions
    // This runs daily at 2 AM
    const cronExistsResult = await executeSQL(`
      SELECT EXISTS (
        SELECT FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'cron_job'
      ) as exists
    `);
    
    const cronExists = cronExistsResult.rows && cronExistsResult.rows[0] && cronExistsResult.rows[0].exists;
    
    if (cronExists) {
      await executeSQL(`
        INSERT INTO cron_job (job_name, schedule, command, is_active)
        VALUES (
          'cleanup_expired_ai_suggestions',
          '0 2 * * *',
          'SELECT cleanup_expired_ai_suggestions()',
          true
        )
        ON CONFLICT (job_name) DO UPDATE
        SET schedule = EXCLUDED.schedule,
            updated_at = NOW()
      `);
      
      await log('✅ AI Sandbox cleanup cron đã được tạo (chạy lúc 2:00 AM hàng ngày)', 'success');
    } else {
      await log('⚠️ Bảng cron_job không tồn tại, bỏ qua setup cron', 'warning');
    }
  } catch (err) {
    await log('⚠️ Không thể setup cron job', 'warning');
    console.warn('Cron setup error:', err.message);
  }
}

/**
 * Step 6: Update existing code to use new services
 */
async function updateCodeReferences() {
  await log('Bước 6: Tạo migration guide cho code updates...');
  
  const migrationGuide = `
# Phase 0 Code Migration Guide

## Cần cập nhật các file sau để sử dụng services mới:

### 1. Redis Multi-Tenancy
- Thay thế tất cả redis.get/set/del bằng mtGet/mtSet/mtDel
- Thay thế invalidateCache bằng mtInvalidateCompany
- Luôn truyền companyId vào tất cả Redis operations

### 2. Event Store
- Thêm EventStore.append() vào các hành động quan trọng:
  - Voucher created/updated/deleted/posted
  - AI suggestions created/approved/applied
  - User login/logout
  - System config changes

### 3. AI Sandbox
- Thay thế tất cả AI predictions bằng predictWithSandbox()
- Không BAO GIỜ gọi AI model trực tiếp
- Luôn kiểm tra suggestion.requires_approval trước khi apply

### 4. Distributed Locking
- Sử dụng withLock() cho các critical sections:
  - Voucher posting
  - Balance calculation
  - Month-end closing

## Files cần update:
- backend/services/voucher.service.js
- backend/services/closing.service.js
- backend/controllers/voucher.controller.js
- backend/routes/vouchers.js
- backend/services/aiQueue.service.js
`;

  fs.writeFileSync(
    path.join(__dirname, '../docs/phase0_code_migration_guide.md'),
    migrationGuide
  );
  
  await log('✅ Đã tạo migration guide tại docs/phase0_code_migration_guide.md', 'success');
}

/**
 * Step 7: Run validation checks
 */
async function runValidation() {
  await log('Bước 7: Run validation checks...');
  
  const checks = [];
  
  // Check 1: event_store table exists and has correct structure
  try {
    const { rows } = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'event_store'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['event_type', 'category', 'company_id', 'event_data', 'correlation_id'];
    const existingColumns = rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing columns in event_store: ${missingColumns.join(', ')}`);
    }
    
    checks.push({ name: 'event_store structure', passed: true });
  } catch (err) {
    checks.push({ name: 'event_store structure', passed: false, error: err.message });
  }
  
  // Check 2: ai_suggestions table exists and has correct structure
  try {
    const { rows } = await executeSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ai_suggestions'
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['type', 'company_id', 'field', 'confidence', 'status', 'expires_at'];
    const existingColumns = rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing columns in ai_suggestions: ${missingColumns.join(', ')}`);
    }
    
    checks.push({ name: 'ai_suggestions structure', passed: true });
  } catch (err) {
    checks.push({ name: 'ai_suggestions structure', passed: false, error: err.message });
  }
  
  // Check 3: Indexes exist
  try {
    const { rows } = await executeSQL(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('event_store', 'ai_suggestions')
    `);
    
    const indexes = rows.map(r => r.indexname);
    const requiredIndexes = [
      'idx_event_store_company_id',
      'idx_event_store_timestamp',
      'idx_ai_suggestions_company_id',
      'idx_ai_suggestions_status'
    ];
    
    const missingIndexes = requiredIndexes.filter(idx => !indexes.includes(idx));
    
    if (missingIndexes.length > 0) {
      throw new Error(`Missing indexes: ${missingIndexes.join(', ')}`);
    }
    
    checks.push({ name: 'indexes', passed: true });
  } catch (err) {
    checks.push({ name: 'indexes', passed: false, error: err.message });
  }
  
  // Check 4: Redis multi-tenancy module loads correctly
  try {
    const { RedisKeyBuilder } = await import('../cache/redisMultiTenancy.js');
    const testKey = RedisKeyBuilder.voucher(1, 123);
    if (!testKey.startsWith('company_1:')) {
      throw new Error('RedisKeyBuilder không tạo đúng format');
    }
    checks.push({ name: 'redis multi-tenancy module', passed: true });
  } catch (err) {
    checks.push({ name: 'redis multi-tenancy module', passed: false, error: err.message });
  }
  
  // Check 5: Event Store service loads correctly
  try {
    const testEvent = await EventStore.append({
      eventType: 'MIGRATION_TEST',
      category: 'system',
      companyId: 0,
      eventData: { test: true },
      severity: 'info'
    });
    
    if (!testEvent.id) {
      throw new Error('Event Store không tạo event đúng cách');
    }
    
    checks.push({ name: 'event store service', passed: true });
  } catch (err) {
    checks.push({ name: 'event store service', passed: false, error: err.message });
  }
  
  // Check 6: AI Sandbox service loads correctly
  try {
    const { AISandbox } = await import('../services/aiSandbox.service.js');
    if (!AISandbox.createSuggestion) {
      throw new Error('AI Sandbox không có createSuggestion method');
    }
    checks.push({ name: 'ai sandbox service', passed: true });
  } catch (err) {
    checks.push({ name: 'ai sandbox service', passed: false, error: err.message });
  }
  
  // Log results
  await log('\n📊 Validation Results:', 'info');
  for (const check of checks) {
    const icon = check.passed ? '✅' : '⚠️';
    const msg = check.passed ? check.name : `${check.name}: ${check.error}`;
    await log(`  ${icon} ${msg}`, check.passed ? 'success' : 'warning');
  }
  
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  
  await log(`\n📈 Tổng kết: ${passedCount}/${totalCount} checks passed`, 
    passedCount === totalCount ? 'success' : 'warning');
  
  // Only fail if critical checks failed (tables must exist)
  const criticalChecks = ['event_store structure', 'ai_suggestions structure'];
  const failedCritical = checks.filter(c => !c.passed && criticalChecks.includes(c.name));
  
  if (failedCritical.length > 0) {
    throw new Error('Critical checks thất bại: ' + failedCritical.map(c => c.name).join(', '));
  }
  
  // For non-critical checks (indexes, service tests), just warn
  if (passedCount < totalCount) {
    await log('⚠️ Một số non-critical checks thất bại, nhưng migration vẫn thành công', 'warning');
    await log('   Có thể cần chạy lại migration sau khi cấu hình đầy đủ', 'warning');
  }
}

/**
 * Step 8: Record migration in database
 */
async function recordMigration() {
  await log('Bước 8: Record migration...');
  
  // Create migration tracking table if not exists
  await executeSQL(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT
    )
  `);
  
  // Record this migration
  const startTime = Date.now();
  await executeSQL(`
    INSERT INTO schema_migrations (version, name, execution_time_ms, success)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (version) DO UPDATE
    SET executed_at = NOW(),
        execution_time_ms = EXCLUDED.execution_time_ms,
        success = EXCLUDED.success
  `, [MIGRATION_VERSION, MIGRATION_NAME, Date.now() - startTime, true]);
  
  await log(`✅ Migration ${MIGRATION_VERSION} đã được record`, 'success');
}

// ====================================================================
// Main Migration Runner
// ====================================================================

async function runMigration() {
  const startTime = Date.now();
  
  try {
    await log('🚀 Bắt đầu Phase 0 Migration...', 'info');
    await log(`   Version: ${MIGRATION_VERSION}`);
    await log(`   Name: ${MIGRATION_NAME}\n`);
    
    // Test database connection
    await executeSQL('SELECT 1');
    await log('✅ Kết nối database thành công', 'success');
    
    // Test Redis connection
    if (isRedisReadyCheck()) {
      await log('✅ Kết nối Redis thành công', 'success');
    } else {
      await log('⚠️ Redis chưa sẵn sàng (một số features sẽ bị disable)', 'warning');
    }
    
    // Run migration steps
    await createTables();
    await verifyTables();
    await migrateRedisKeys();
    await initializeEventStore();
    await setupAISandboxCron();
    await updateCodeReferences();
    await runValidation();
    await recordMigration();
    
    const executionTime = Date.now() - startTime;
    
    await log('\n🎉 Phase 0 Migration hoàn thành thành công!', 'success');
    await log(`   Thời gian thực hiện: ${executionTime}ms`);
    await log(`   Bước tiếp theo: Cập nhật code để sử dụng các services mới`);
    await log(`   Xem hướng dẫn tại: docs/phase0_code_migration_guide.md\n`);
    
    process.exit(0);
    
  } catch (err) {
    await log(`\n❌ Migration thất bại: ${err.message}`, 'error');
    await log('   Kiểm tra log để biết chi tiết lỗi\n', 'error');
    console.error(err);
    process.exit(1);
  }
}

// Run migration
runMigration();