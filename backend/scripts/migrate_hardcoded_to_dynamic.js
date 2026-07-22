/**
 * Migration Script: Hard-coded values → Dynamic Config System
 * 
 * This script migrates hard-coded values in 25 core files to use the
 * Configuration Management System (system_configs table + configHelper.js)
 * 
 * Usage:
 *   node scripts/migrate_hardcoded_to_dynamic.js --core    # Migrate 25 core files
 *   node scripts/migrate_hardcoded_to_dynamic.js --service # Migrate 15 service files
 *   node scripts/migrate_hardcoded_to_dynamic.js --all     # Migrate all 40 files
 *   node scripts/migrate_hardcoded_to_dynamic.js --dry-run # Preview changes without applying
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

// ====================================================================
// CONFIGURATION MAPPINGS
// ====================================================================

// Map hard-coded values to config keys
// ONLY include specific, unambiguous values to avoid false positives
const VALUE_TO_CONFIG_MAP = {
  // Tax Rates (decimal format - very specific)
  '0.08': { configKey: 'tax.standard_vat_rate', type: 'number', defaultValue: 8, transform: (v) => v / 100 },
  '0.1': { configKey: 'tax.service_vat_rate', type: 'number', defaultValue: 10, transform: (v) => v / 100 },
  
  // Financial Thresholds (large numbers - unlikely to appear elsewhere)
  '3000000000': { configKey: 'financial.threshold_revenue_3b', type: 'number' },
  '50000000000': { configKey: 'financial.threshold_revenue_50b', type: 'number' },
  '5000000': { configKey: 'financial.ai_auto_post_max', type: 'number' },
  '50000000': { configKey: 'financial.ai_human_review_max', type: 'number' },
  '100000000': { configKey: 'financial.ai_cashflow_large', type: 'number' },
  '500000000': { configKey: 'financial.credit_limit_default', type: 'number' },
  
  // Days (only very specific values that won't appear as loop counters)
  '3650': { configKey: 'legal.data_retention_days', type: 'number' },
  
  // Percentages
  '0.02': { configKey: 'pricing.early_payment_discount', type: 'number' },
  '0.215': { configKey: 'payroll.employer_insurance_rate', type: 'number' },
  '0.105': { configKey: 'payroll.employee_insurance_rate', type: 'number' },
  '0.8': { configKey: 'factoring.default_advance_rate', type: 'number' },
  '0.01': { configKey: 'factoring.default_fee_rate', type: 'number' },
  
  // Account Codes (quoted strings - very specific)
  "'1111'": { configKey: 'accounts.cash', type: 'string' },
  "'1121'": { configKey: 'accounts.bank', type: 'string' },
  "'1122'": { configKey: 'accounts.bank_fc', type: 'string' },
  "'131'": { configKey: 'accounts.ar', type: 'string' },
  "'1368'": { configKey: 'accounts.ar_internal', type: 'string' },
  "'141'": { configKey: 'accounts.advance', type: 'string' },
  "'152'": { configKey: 'accounts.raw_material', type: 'string' },
  "'154'": { configKey: 'accounts.wip', type: 'string' },
  "'155'": { configKey: 'accounts.finished_goods', type: 'string' },
  "'1561'": { configKey: 'accounts.merchandise', type: 'string' },
  "'1331'": { configKey: 'accounts.tax_in', type: 'string' },
  "'33311'": { configKey: 'accounts.tax_out', type: 'string' },
  "'331'": { configKey: 'accounts.ap', type: 'string' },
  "'3368'": { configKey: 'accounts.ap_internal', type: 'string' },
  "'334'": { configKey: 'accounts.payroll', type: 'string' },
  "'338'": { configKey: 'accounts.insurance', type: 'string' },
  "'3387'": { configKey: 'accounts.unearned_rev', type: 'string' },
  "'1388'": { configKey: 'accounts.holdback', type: 'string' },
  "'1381'": { configKey: 'accounts.asset_missing', type: 'string' },
  "'341'": { configKey: 'accounts.short_term_borrow', type: 'string' },
  "'4131'": { configKey: 'accounts.forex_diff', type: 'string' },
  "'5111'": { configKey: 'accounts.revenue', type: 'string' },
  "'515'": { configKey: 'accounts.fin_revenue', type: 'string' },
  "'632'": { configKey: 'accounts.cogs', type: 'string' },
  "'635'": { configKey: 'accounts.fin_expense', type: 'string' },
  "'641'": { configKey: 'accounts.sales_expense', type: 'string' },
  "'6422'": { configKey: 'accounts.admin_expense', type: 'string' },
  "'2141'": { configKey: 'accounts.depreciation', type: 'string' },
  "'6274'": { configKey: 'accounts.depreciation_expense', type: 'string' },
  "'621'": { configKey: 'accounts.material_cost', type: 'string' },
  "'622'": { configKey: 'accounts.labor_cost', type: 'string' },
  "'627'": { configKey: 'accounts.overhead_cost', type: 'string' },
  "'711'": { configKey: 'accounts.other_income', type: 'string' },
  "'521'": { configKey: 'accounts.rebate', type: 'string' },
  "'2293'": { configKey: 'accounts.bad_debt_provision', type: 'string' },
  "'511'": { configKey: 'accounts.revenue_short', type: 'string' },
  "'3331'": { configKey: 'accounts.vat_payable', type: 'string' },
  "'3334'": { configKey: 'accounts.corporate_tax_payable', type: 'string' },
  "'4212'": { configKey: 'accounts.retained_earnings', type: 'string' },
  "'821'": { configKey: 'accounts.tax_expense', type: 'string' },
  "'911'": { configKey: 'accounts.closing', type: 'string' },
  "'811'": { configKey: 'accounts.other_expense', type: 'string' },
  "'242'": { configKey: 'accounts.prepaid_expense', type: 'string' },
  "'211'": { configKey: 'accounts.fixed_asset', type: 'string' },
  "'214'": { configKey: 'accounts.accumulated_depreciation', type: 'string' },
  "'611'": { configKey: 'accounts.depreciation_expense_short', type: 'string' },
  "'335'": { configKey: 'accounts.doubtful_debt_provision', type: 'string' },
  "'215'": { configKey: 'accounts.biological_asset', type: 'string' },
  "'2295'": { configKey: 'accounts.biological_provision', type: 'string' },
  "'3311'": { configKey: 'accounts.ap_short', type: 'string' },
  "'1562'": { configKey: 'accounts.logistics', type: 'string' },
  "'156'": { configKey: 'accounts.inventory', type: 'string' },
  "'312'": { configKey: 'accounts.customer_advance', type: 'string' },
  "'223'": { configKey: 'accounts.depreciation_display', type: 'string' },
  "'3339'": { configKey: 'accounts.tax_mon_bai', type: 'string' },
  "'419'": { configKey: 'accounts.treasury_stock', type: 'string' },
  "'531'": { configKey: 'accounts.sales_return', type: 'string' },
  "'532'": { configKey: 'accounts.sales_discount', type: 'string' },
  
  // Voucher Types (quoted strings)
  "'WEB'": { configKey: 'voucher.storefront_prefix', type: 'string' },
  "'XK'": { configKey: 'voucher.sale_voucher_type', type: 'string' },
  "'NK'": { configKey: 'voucher.inbound_voucher_type', type: 'string' },
  "'DauKy'": { configKey: 'voucher.closing_voucher_type', type: 'string' },
  "'pending_loading'": { configKey: 'voucher.default_loading_status', type: 'string' },
  
  // Queue Names
  "'order-ingestion'": { configKey: 'integration.order_ingestion_queue', type: 'string' },
  
  // Currency
  "'VND'": { configKey: 'integration.default_currency', type: 'string' },
  
  // Status Values (quoted strings)
  "'Frozen'": { configKey: 'credit.frozen_status', type: 'string' },
  "'Approved'": { configKey: 'credit.approved_status', type: 'string' },
  "'PENDING'": { configKey: 'workflow.default_status', type: 'string' },
  "'PENDING_APPROVAL'": { configKey: 'workflow.pending_approval_status', type: 'string' },
};

// ====================================================================
// FILE MAPPINGS
// ====================================================================

const CORE_FILES = [
  'config/businessRules.js',
  'config/closingWorkflow.js',
  'config/aiConfig.js',
  'core/rea/reaEventMapper.js',
  'services/taxRule.service.js',
  'services/logistics.service.js',
  'services/aiBatchProcessor.service.js',
  'services/closing.service.js',
  'services/casso.service.js',
  'workers/orderQueue.js',
  'middleware/waf.js',
  'middleware/rateLimiter.js',
  'utils/accountingEngine.js',
  'core/ioMatrix.js',
  'routes/accounting.js',
  'controllers/erpController.js',
  'controllers/notification.controller.js',
  'services/aiDepartmentClassifier.service.js',
  'services/aiJournal.service.js',
  'services/aiSmartSuggestions.service.js',
  'services/geminiClient.js',
  'services/aiWorkflowEngine.service.js',
  'services/queue.service.js',
  'services/eventStore.service.js',
  'services/projectionEngine.service.js',
];

const SERVICE_FILES = [
  'services/aiBatchProcessor.service.js',
  'services/geminiClient.js',
  'services/queue.service.js',
  'services/eventStore.service.js',
  'services/notification.service.js',
  'services/pushNotification.service.js',
  'services/casso.service.js',
  'services/aiWorkflowEngine.service.js',
  'services/aiSmartSuggestions.service.js',
  'services/aiDepartmentClassifier.service.js',
  'services/aiJournal.service.js',
  'services/closing.service.js',
  'services/taxRule.service.js',
  'services/logistics.service.js',
  'services/projectionEngine.service.js',
];

// ====================================================================
// MIGRATION LOGIC
// ====================================================================

let migrationLog = [];
let stats = {
  filesProcessed: 0,
  filesSkipped: 0,
  replacements: 0,
  errors: 0,
};

/**
 * Generate config helper function call
 */
function getConfigHelperCode(configKey, type, defaultValue) {
  const category = configKey.split('.')[0];
  const key = configKey.split('.')[1];
  
  if (type === 'number') {
    if (defaultValue !== undefined) {
      return `getConfigNumber('${configKey}', ${defaultValue}, companyId)`;
    }
    return `getConfigNumber('${configKey}', companyId)`;
  } else if (type === 'string') {
    if (defaultValue !== undefined) {
      return `getConfigString('${configKey}', '${defaultValue}', companyId)`;
    }
    return `getConfigString('${configKey}', companyId)`;
  }
  
  return `getConfig('${configKey}', companyId)`;
}

/**
 * Check if a match is inside a function body (not at module level)
 */
function isInsideFunction(content, matchIndex) {
  // Look backwards from the match to find the nearest function keyword
  const beforeMatch = content.substring(0, matchIndex);
  
  // Find the last 'function' keyword or arrow function before this match
  const functionPatterns = [
    /function\s+\w*\s*\([^)]*\)\s*\{/g,
    /=>\s*\{/g,
    /\([^)]*\)\s*=>/g
  ];
  
  let lastFunctionIndex = -1;
  for (const pattern of functionPatterns) {
    const matches = beforeMatch.matchAll(pattern);
    for (const match of matches) {
      if (match.index > lastFunctionIndex) {
        lastFunctionIndex = match.index;
      }
    }
  }
  
  // If we found a function, check if we're inside it
  if (lastFunctionIndex >= 0) {
    // Count braces between function start and match
    const between = content.substring(lastFunctionIndex, matchIndex);
    const openBraces = (between.match(/\{/g) || []).length;
    const closeBraces = (between.match(/\}/g) || []).length;
    
    // If more open braces than close, we're inside the function
    return openBraces > closeBraces;
  }
  
  return false;
}

/**
 * Replace hard-coded value with config helper call
 * Only replaces inside function bodies, not at module level
 */
function replaceHardCodedValue(content, value, configInfo) {
  const configCall = getConfigHelperCode(configInfo.configKey, configInfo.type, configInfo.defaultValue);
  
  // Escape special regex characters in value
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create regex pattern to match the value
  const pattern = new RegExp(escapedValue, 'g');
  
  // Find all matches
  const matches = content.match(pattern);
  if (!matches) return { content, replacements: 0 };
  
  // Only replace matches that are inside functions
  let replacementCount = 0;
  let newContent = content;
  
  // Find all match positions
  let matchPosition = 0;
  for (let i = 0; i < matches.length; i++) {
    const index = newContent.indexOf(escapedValue, matchPosition);
    if (index === -1) break;
    
    // Check if this match is inside a function
    if (isInsideFunction(newContent, index)) {
      // Replace this occurrence
      newContent = newContent.substring(0, index) + configCall + newContent.substring(index + escapedValue.length);
      replacementCount++;
      matchPosition = index + configCall.length;
    } else {
      matchPosition = index + escapedValue.length;
    }
  }
  
  return {
    content: newContent,
    replacements: replacementCount,
  };
}

/**
 * Process a single file
 */
function processFile(filePath, dryRun = false) {
  const fullPath = path.join(BACKEND_DIR, filePath);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    stats.filesSkipped++;
    return;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let originalContent = content;
    let totalReplacements = 0;
    const replacements = [];
    
    // Apply replacements
    for (const [value, configInfo] of Object.entries(VALUE_TO_CONFIG_MAP)) {
      const result = replaceHardCodedValue(content, value, configInfo);
      if (result.replacements > 0) {
        content = result.content;
        totalReplacements += result.replacements;
        replacements.push({
          value,
          configKey: configInfo.configKey,
          count: result.replacements,
        });
      }
    }
    
    // Check if changes were made
    if (content === originalContent) {
      console.log(`✓ ${filePath} - No hard-coded values found`);
      stats.filesSkipped++;
      return;
    }
    
    // Log changes
    console.log(`\n📝 ${filePath}:`);
    console.log(`   Replacements: ${totalReplacements}`);
    replacements.forEach(r => {
      console.log(`   - ${r.value} → ${r.configKey} (${r.count}x)`);
    });
    
    if (!dryRun) {
      // Create backup
      const backupPath = `${fullPath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, originalContent);
      
      // Write updated file
      fs.writeFileSync(fullPath, content, 'utf8');
      
      console.log(`   ✅ Updated (backup: ${path.basename(backupPath)})`);
    } else {
      console.log(`   🔍 DRY RUN - No changes applied`);
    }
    
    migrationLog.push({
      file: filePath,
      replacements,
      totalReplacements,
    });
    
    stats.filesProcessed++;
    stats.replacements += totalReplacements;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

/**
 * Generate config seed SQL
 */
function generateConfigSeedSQL() {
  const configs = new Map();
  
  // Collect all unique config keys from replacements
  for (const configInfo of Object.values(VALUE_TO_CONFIG_MAP)) {
    if (!configs.has(configInfo.configKey)) {
      configs.set(configInfo.configKey, {
        configKey: configInfo.configKey,
        valueType: configInfo.type,
        category: configInfo.configKey.split('.')[0].toUpperCase(),
        defaultValue: configInfo.defaultValue,
      });
    }
  }
  
  // Generate SQL
  let sql = `-- ====================================================================
-- CONFIG SEED: Migrated from hard-coded values
-- Generated: ${new Date().toISOString()}
-- ====================================================================

INSERT INTO system_configs (config_key, config_value, value_type, category, description, is_system, created_at, updated_at)
VALUES\n`;
  
  const values = [];
  for (const [key, config] of configs) {
    const value = config.defaultValue !== undefined ? config.defaultValue : '';
    const description = `Migrated from hard-coded value (${config.valueType})`;
    const now = new Date().toISOString();
    
    values.push(`  ('${key}', '${value}', '${config.valueType}', '${config.category}', '${description}', true, '${now}', '${now}')`);
  }
  
  sql += values.join(',\n') + ';\n';
  
  return sql;
}

/**
 * Generate import statement for configHelper
 */
function generateImportStatement() {
  return `import { getConfigNumber, getConfigString, getConfig } from '../../utils/configHelper.js';\n`;
}

/**
 * Add import statement to file if not present
 */
function addImportStatement(filePath, dryRun = false) {
  const fullPath = path.join(BACKEND_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if import already exists
  if (content.includes("from '../../utils/configHelper.js'") || 
      content.includes('from "../../utils/configHelper.js"')) {
    return;
  }
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].startsWith('import\t')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    const importStatement = generateImportStatement();
    lines.splice(lastImportIndex + 1, 0, '', importStatement);
    
    if (!dryRun) {
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
      console.log(`   + Added configHelper import to ${filePath}`);
    } else {
      console.log(`   + [DRY RUN] Would add configHelper import to ${filePath}`);
    }
  }
}

// ====================================================================
// MAIN EXECUTION
// ====================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  let filesToProcess = [];
  
  if (args.includes('--core')) {
    filesToProcess = CORE_FILES;
    console.log('🚀 Starting migration for 25 CORE files...\n');
  } else if (args.includes('--service')) {
    filesToProcess = SERVICE_FILES;
    console.log('🚀 Starting migration for 15 SERVICE files...\n');
  } else if (args.includes('--all')) {
    filesToProcess = [...new Set([...CORE_FILES, ...SERVICE_FILES])];
    console.log('🚀 Starting migration for ALL files...\n');
  } else {
    console.log(`
Usage:
  node scripts/migrate_hardcoded_to_dynamic.js --core    # Migrate 25 core files
  node scripts/migrate_hardcoded_to_dynamic.js --service # Migrate 15 service files
  node scripts/migrate_hardcoded_to_dynamic.js --all     # Migrate all 40 files
  node scripts/migrate_hardcoded_to_dynamic.js --dry-run # Preview changes without applying

Options:
  --dry-run   Preview changes without applying them
  --core      Process 25 core files
  --service   Process 15 service files
  --all       Process all 40 files
    `);
    process.exit(0);
  }
  
  // Process files
  filesToProcess.forEach(filePath => {
    processFile(filePath, dryRun);
  });
  
  // Add import statements (only if not dry run)
  if (!dryRun) {
    console.log('\n📦 Adding configHelper imports...\n');
    filesToProcess.forEach(filePath => {
      addImportStatement(filePath, dryRun);
    });
  }
  
  // Generate SQL seed
  const sql = generateConfigSeedSQL();
  const sqlPath = path.join(BACKEND_DIR, 'scripts', 'migrated_configs_seed.sql');
  fs.writeFileSync(sqlPath, sql);
  console.log(`\n📊 Generated config seed SQL: ${sqlPath}`);
  
  // Generate migration report
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files skipped: ${stats.filesSkipped}`);
  console.log(`Total replacements: ${stats.replacements}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(70));
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No files were modified');
    console.log('Run without --dry-run to apply changes\n');
  } else {
    console.log('\n✅ Migration completed!');
    console.log('\nNext steps:');
    console.log('1. Review the changes in each file');
    console.log('2. Run the SQL seed: psql -f scripts/migrated_configs_seed.sql');
    console.log('3. Test the application: npm test');
    console.log('4. If issues arise, restore from .backup.* files\n');
  }
  
  // Save detailed log
  const logPath = path.join(BACKEND_DIR, 'scripts', 'migration_log.json');
  fs.writeFileSync(logPath, JSON.stringify(migrationLog, null, 2));
  console.log(`📋 Detailed log saved: ${logPath}\n`);
}

main();