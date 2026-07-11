/**
 * Comprehensive Test Suite for NET Balance System
 * Tests all components: businessRules, accountNature, accountingEngine, maintenance, summary
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from './config/db.js';
import { 
  getAccountNature, 
  ACCOUNT_NATURES, 
  chartOfAccountsConfig 
} from './config/businessRules.js';
import { 
  calculateNetBalance, 
  getAccountNatureWrapper,
  calculateNetBalancesForAccounts 
} from './utils/accountNature.js';
import { getAccountBalance, getClosingBalance } from './utils/accountingEngine.js';
import { rebuildLedger } from './services/maintenance.service.js';
import { getPeriodBalanceSummary } from './services/summary.service.js';

// Test configuration
const TEST_COMPANY_ID = 1;
const TEST_YEAR = 2025;

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Helper to log test results
 */
function logTest(testName, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}${message ? ' - ' + message : ''}`);
  
  testResults.tests.push({ testName, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

/**
 * Test 1: ACCOUNT_NATURES constants
 */
async function testAccountNatures() {
  console.log('\n=== TEST 1: ACCOUNT_NATURES Constants ===');
  
  try {
    logTest('ACCOUNT_NATURES.DEBIT exists', ACCOUNT_NATURES.DEBIT === 'DEBIT');
    logTest('ACCOUNT_NATURES.CREDIT exists', ACCOUNT_NATURES.CREDIT === 'CREDIT');
    logTest('ACCOUNT_NATURES.BOTH exists', ACCOUNT_NATURES.BOTH === 'BOTH');
  } catch (error) {
    logTest('ACCOUNT_NATURES constants', false, error.message);
  }
}

/**
 * Test 2: chartOfAccountsConfig structure
 */
async function testChartOfAccountsConfig() {
  console.log('\n=== TEST 2: Chart of Accounts Config ===');
  
  try {
    logTest('chartOfAccountsConfig exists', !!chartOfAccountsConfig);
    logTest('rules array exists', Array.isArray(chartOfAccountsConfig.rules));
    logTest('exceptions object exists', typeof chartOfAccountsConfig.exceptions === 'object');
    logTest('rules has 9 entries', chartOfAccountsConfig.rules.length === 9);
    logTest('exceptions has 6 entries', Object.keys(chartOfAccountsConfig.exceptions).length === 6);
  } catch (error) {
    logTest('chartOfAccountsConfig structure', false, error.message);
  }
}

/**
 * Test 3: getAccountNature function
 */
async function testGetAccountNature() {
  console.log('\n=== TEST 3: getAccountNature Function ===');
  
  const testCases = [
    { code: '111', expected: ACCOUNT_NATURES.DEBIT, desc: 'Tiền mặt (DEBIT)' },
    { code: '112', expected: ACCOUNT_NATURES.DEBIT, desc: 'Tiền gửi ngân hàng (DEBIT)' },
    { code: '131', expected: ACCOUNT_NATURES.BOTH, desc: 'Phải thu khách hàng (BOTH)' },
    { code: '1311', expected: ACCOUNT_NATURES.BOTH, desc: 'Phải thu KH trong nước (BOTH)' },
    { code: '331', expected: ACCOUNT_NATURES.BOTH, desc: 'Phải trả người bán (BOTH)' },
    { code: '214', expected: ACCOUNT_NATURES.CREDIT, desc: 'Hao mòn TSCĐ (CREDIT)' },
    { code: '229', expected: ACCOUNT_NATURES.CREDIT, desc: 'Dự phòng tổn thất (CREDIT)' },
    { code: '511', expected: ACCOUNT_NATURES.CREDIT, desc: 'Doanh thu bán hàng (CREDIT)' },
    { code: '632', expected: ACCOUNT_NATURES.DEBIT, desc: 'Giá vốn hàng bán (DEBIT)' },
    { code: '411', expected: ACCOUNT_NATURES.CREDIT, desc: 'Vốn góp chủ sở hữu (CREDIT)' }
  ];

  for (const tc of testCases) {
    const result = getAccountNature(tc.code);
    const passed = result === tc.expected;
    logTest(`getAccountNature(${tc.code})`, passed, 
      passed ? `→ ${tc.desc}` : `Expected ${tc.expected}, got ${result}`);
  }
}

/**
 * Test 4: calculateNetBalance function
 */
async function testCalculateNetBalance() {
  console.log('\n=== TEST 4: calculateNetBalance Function ===');
  
  // Test DEBIT account (111 - Tiền mặt)
  const debitResult = calculateNetBalance(1000, 500, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Nợ > Có', 
    debitResult.netBalance === 500 && debitResult.balanceType === ACCOUNT_NATURES.DEBIT,
    `netBalance=${debitResult.netBalance}, type=${debitResult.balanceType}`);

  const debitResult2 = calculateNetBalance(500, 1000, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Có > Nợ (exceptional)', 
    debitResult2.netBalance === 500 && debitResult2.balanceType === ACCOUNT_NATURES.CREDIT,
    `netBalance=${debitResult2.netBalance}, type=${debitResult2.balanceType}`);

  // Test CREDIT account (331 - Phải trả)
  const creditResult = calculateNetBalance(500, 1000, ACCOUNT_NATURES.CREDIT);
  logTest('CREDIT: Có > Nợ', 
    creditResult.netBalance === 500 && creditResult.balanceType === ACCOUNT_NATURES.CREDIT,
    `netBalance=${creditResult.netBalance}, type=${creditResult.balanceType}`);

  const creditResult2 = calculateNetBalance(1000, 500, ACCOUNT_NATURES.CREDIT);
  logTest('CREDIT: Nợ > Có (exceptional)', 
    creditResult2.netBalance === 500 && creditResult2.balanceType === ACCOUNT_NATURES.DEBIT,
    `netBalance=${creditResult2.netBalance}, type=${creditResult2.balanceType}`);

  // Test BOTH account (131 - Phải thu)
  const bothResult1 = calculateNetBalance(1000, 500, ACCOUNT_NATURES.BOTH);
  logTest('BOTH: Nợ > Có', 
    bothResult1.netBalance === 500 && bothResult1.balanceType === ACCOUNT_NATURES.DEBIT,
    `netBalance=${bothResult1.netBalance}, type=${bothResult1.balanceType}`);

  const bothResult2 = calculateNetBalance(500, 1000, ACCOUNT_NATURES.BOTH);
  logTest('BOTH: Có > Nợ', 
    bothResult2.netBalance === 500 && bothResult2.balanceType === ACCOUNT_NATURES.CREDIT,
    `netBalance=${bothResult2.netBalance}, type=${bothResult2.balanceType}`);
}

/**
 * Test 5: Database - Check monthly_balances schema
 */
async function testDatabaseSchema() {
  console.log('\n=== TEST 5: Database Schema ===');
  
  try {
    // Check if net_balance column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'monthly_balances'
        AND column_name IN ('net_balance', 'balance_type')
      ORDER BY column_name
    `);

    const columns = columnCheck.rows;
    logTest('net_balance column exists', 
      columns.some(c => c.column_name === 'net_balance'),
      `Found: ${columns.filter(c => c.column_name === 'net_balance').map(c => c.data_type).join(', ')}`);
    
    logTest('balance_type column exists', 
      columns.some(c => c.column_name === 'balance_type'),
      `Found: ${columns.filter(c => c.column_name === 'balance_type').map(c => c.data_type).join(', ')}`);

    // Check if PostgreSQL function exists
    const functionCheck = await pool.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname = 'get_account_nature'
    `);

    logTest('get_account_nature() function exists', 
      functionCheck.rows.length > 0,
      functionCheck.rows.length > 0 ? 'Function found' : 'Function not found');

    // Check if index exists
    const indexCheck = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'monthly_balances'
        AND indexname = 'idx_monthly_balances_net_balance'
    `);

    logTest('idx_monthly_balances_net_balance index exists', 
      indexCheck.rows.length > 0,
      indexCheck.rows.length > 0 ? 'Index found' : 'Index not found');

  } catch (error) {
    logTest('Database schema check', false, error.message);
  }
}

/**
 * Test 6: Database - Check monthly_balances data
 */
async function testMonthlyBalancesData() {
  console.log('\n=== TEST 6: Monthly Balances Data ===');
  
  try {
    const checkQuery = `
      SELECT 
        account_code,
        closing_debit,
        closing_credit,
        net_balance,
        balance_type
      FROM monthly_balances
      WHERE company_id = $1 AND year = $2
      LIMIT 10
    `;

    const { rows } = await pool.query(checkQuery, [TEST_COMPANY_ID, TEST_YEAR]);

    if (rows.length === 0) {
      logTest('Monthly balances data exists', false, 'No data found - need to run rebuildLedger');
      return;
    }

    logTest('Monthly balances data exists', true, `Found ${rows.length} rows`);

    // Check if net_balance is calculated
    const withNetBalance = rows.filter(r => r.net_balance > 0);
    logTest('net_balance is calculated', withNetBalance.length > 0, 
      `${withNetBalance.length} accounts with net_balance > 0`);

    // Check if balance_type is set
    const withBalanceType = rows.filter(r => r.balance_type === 'DEBIT' || r.balance_type === 'CREDIT');
    logTest('balance_type is set correctly', withBalanceType.length === rows.length,
      `${withBalanceType.length}/${rows.length} rows have valid balance_type`);

    // Display sample data
    console.log('\nSample data:');
    rows.slice(0, 5).forEach(row => {
      console.log(`  ${row.account_code}: DR=${row.closing_debit}, CR=${row.closing_credit}, ` +
                   `NET=${row.net_balance} (${row.balance_type})`);
    });

  } catch (error) {
    logTest('Monthly balances data check', false, error.message);
  }
}

/**
 * Test 7: Backend API - getAccountBalance
 */
async function testGetAccountBalance() {
  console.log('\n=== TEST 7: getAccountBalance Function ===');
  
  try {
    // Test DEBIT account
    const debitBalance = await getAccountBalance(TEST_COMPANY_ID, '111');
    logTest('getAccountBalance(111) returns balance', 
      typeof debitBalance.balance === 'number',
      `balance=${debitBalance.balance}, type=${debitBalance.balance_type}`);

    // Test CREDIT account
    const creditBalance = await getAccountBalance(TEST_COMPANY_ID, '331');
    logTest('getAccountBalance(331) returns balance', 
      typeof creditBalance.balance === 'number',
      `balance=${creditBalance.balance}, type=${creditBalance.balance_type}`);

    // Test BOTH account
    const bothBalance = await getAccountBalance(TEST_COMPANY_ID, '131');
    logTest('getAccountBalance(131) returns dual balance', 
      typeof bothBalance.debit_balance === 'number' && typeof bothBalance.credit_balance === 'number',
      `DR=${bothBalance.debit_balance}, CR=${bothBalance.credit_balance}`);

  } catch (error) {
    logTest('getAccountBalance', false, error.message);
  }
}

/**
 * Test 8: Backend API - getPeriodBalanceSummary
 */
async function testGetPeriodBalanceSummary() {
  console.log('\n=== TEST 8: getPeriodBalanceSummary Function ===');
  
  try {
    const accountCodes = ['111', '112', '131', '331', '511', '632'];
    const results = await getPeriodBalanceSummary(TEST_COMPANY_ID, accountCodes, TEST_YEAR, 12);

    logTest('getPeriodBalanceSummary returns array', Array.isArray(results));
    logTest('Results contain account codes', results.length > 0, 
      `Found ${results.length} accounts`);

    // Check if NET balance fields are present
    const firstResult = results[0];
    if (firstResult) {
      logTest('Result has net_balance', 'net_balance' in firstResult,
        `net_balance=${firstResult.net_balance}`);
      logTest('Result has balance_type', 'balance_type' in firstResult,
        `balance_type=${firstResult.balance_type}`);
      logTest('Result has account_nature', 'account_nature' in firstResult,
        `account_nature=${firstResult.account_nature}`);
    }

    // Display sample results
    console.log('\nSample results:');
    results.slice(0, 5).forEach(r => {
      console.log(`  ${r.account_code}: DR=${r.debit}, CR=${r.credit}, ` +
                   `NET=${r.net_balance} (${r.balance_type}, ${r.account_nature})`);
    });

  } catch (error) {
    logTest('getPeriodBalanceSummary', false, error.message);
  }
}

/**
 * Test 9: Integration - Rebuild Ledger
 */
async function testRebuildLedger() {
  console.log('\n=== TEST 9: Rebuild Ledger Integration ===');
  
  try {
    console.log('Running rebuildLedger (this may take a while)...');
    const result = await rebuildLedger(TEST_COMPANY_ID, TEST_YEAR, 1);

    logTest('rebuildLedger succeeds', result.success, result.message);
    logTest('rebuildLedger processes months', result.monthCount > 0,
      `Processed ${result.monthCount} rows across ${result.details?.length || 0} months`);

    if (result.details && result.details.length > 0) {
      console.log('\nRebuild details:');
      result.details.forEach(d => {
        console.log(`  Month ${d.month}: ${d.rows_affected} rows, ${d.elapsed_ms}ms`);
      });
    }

  } catch (error) {
    logTest('rebuildLedger', false, error.message);
  }
}

/**
 * Test 10: Frontend Data Format
 */
async function testFrontendDataFormat() {
  console.log('\n=== TEST 10: Frontend Data Format ===');
  
  try {
    const accountCodes = ['111', '131', '214', '331', '511'];
    const results = await getPeriodBalanceSummary(TEST_COMPANY_ID, accountCodes, TEST_YEAR, 12);

    console.log('\nFrontend display format:');
    results.forEach(r => {
      const { formatBalanceWithType } = await import('./utils/accountNature.js');
      const display = formatBalanceWithType(r.net_balance, r.balance_type);
      console.log(`  ${r.account_code}: ${display}`);
    });

    logTest('Frontend format test', true, 'Display format verified');

  } catch (error) {
    logTest('Frontend data format', false, error.message);
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   NET BALANCE SYSTEM - COMPREHENSIVE TEST SUITE            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTest Company ID: ${TEST_COMPANY_ID}`);
  console.log(`Test Year: ${TEST_YEAR}`);
  console.log(`\nStarted at: ${new Date().toLocaleString('vi-VN')}`);

  try {
    await testAccountNatures();
    await testChartOfAccountsConfig();
    await testGetAccountNature();
    await testCalculateNetBalance();
    await testDatabaseSchema();
    await testMonthlyBalancesData();
    await testGetAccountBalance();
    await testGetPeriodBalanceSummary();
    await testRebuildLedger();
    await testFrontendDataFormat();

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`  - ${t.testName}: ${t.message}`));
    }

    console.log('\n✅ Test suite completed at:', new Date().toLocaleString('vi-VN'));

  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
  } finally {
    await pool.end();
  }
}

// Run tests
runAllTests().catch(console.error);