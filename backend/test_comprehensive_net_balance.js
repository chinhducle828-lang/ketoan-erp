/**
 * COMPREHENSIVE TEST SUITE - ALL ACCOUNT TYPES & COMPLEX SCENARIOS
 * Tests every possible business scenario for NET Balance System
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from './config/db.js';
import { getAccountNature, ACCOUNT_NATURES } from './config/businessRules.js';
import { calculateNetBalance, calculateNetBalancesForAccounts } from './utils/accountNature.js';
import { getAccountBalance } from './utils/accountingEngine.js';
import { getPeriodBalanceSummary } from './services/summary.service.js';

const TEST_COMPANY_ID = 1;
const TEST_YEAR = 2025;

const testResults = { passed: 0, failed: 0, tests: [] };

function logTest(testName, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}${message ? ' - ' + message : ''}`);
  testResults.tests.push({ testName, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

// ============================================================================
// SECTION 1: ALL ACCOUNT TYPES - COMPLETE COVERAGE
// ============================================================================

async function testAllAccountTypes() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 1: ALL ACCOUNT TYPES (30+ accounts)              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const allAccounts = [
    // NHÓM 1: TÀI SẢN NGẮN HẠN (DEBIT)
    { code: '111', name: 'Tiền mặt', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '112', name: 'Tiền gửi NH', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '121', name: 'Chứng khoán KD', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '128', name: 'Đầu tư đến hạn', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '131', name: 'Phải thu KH', expected: ACCOUNT_NATURES.BOTH, group: 'Tài sản ngắn hạn' },
    { code: '1311', name: 'Phải thu KH trong nước', expected: ACCOUNT_NATURES.BOTH, group: 'Tài sản ngắn hạn' },
    { code: '1312', name: 'Phải thu KH nước ngoài', expected: ACCOUNT_NATURES.BOTH, group: 'Tài sản ngắn hạn' },
    { code: '133', name: 'Thuế GTGT được khấu trừ', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '136', name: 'Phải thu nội bộ', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '138', name: 'Phải thu khác', expected: ACCOUNT_NATURES.BOTH, group: 'Tài sản ngắn hạn' },
    { code: '1381', name: 'Phải thu khác (ngắn hạn)', expected: ACCOUNT_NATURES.BOTH, group: 'Tài sản ngắn hạn' },
    { code: '141', name: 'Tạm ứng', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '142', name: 'Chi phả phải trả trước', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '152', name: 'Nguyên liệu', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '153', name: 'Công cụ dụng cụ', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '156', name: 'Hàng hóa', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '157', name: 'Hàng gửi đi bán', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },
    { code: '242', name: 'Chi phí trả trước', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản ngắn hạn' },

    // NHÓM 2: TÀI SẢN DÀI HẠN (DEBIT)
    { code: '211', name: 'TSCĐ hữu hình', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản dài hạn' },
    { code: '213', name: 'TSCĐ vô hình', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản dài hạn' },
    { code: '214', name: 'Hao mòn TSCĐ', expected: ACCOUNT_NATURES.CREDIT, group: 'Tài sản dài hạn' },
    { code: '2141', name: 'Hao mòn TSCĐ (chi tiết)', expected: ACCOUNT_NATURES.CREDIT, group: 'Tài sản dài hạn' },
    { code: '215', name: 'Tài sản sinh học', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản dài hạn' },
    { code: '217', name: 'Bất động sản đầu tư', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản dài hạn' },
    { code: '221', name: 'Chi phí SXKD dở dang', expected: ACCOUNT_NATURES.DEBIT, group: 'Tài sản dài hạn' },
    { code: '229', name: 'Dự phòng tổn thất', expected: ACCOUNT_NATURES.CREDIT, group: 'Tài sản dài hạn' },
    { code: '2291', name: 'Dự phòng tổn thất (chi tiết)', expected: ACCOUNT_NATURES.CREDIT, group: 'Tài sản dài hạn' },

    // NHÓM 3: NỢ PHẢI TRẢ (CREDIT)
    { code: '310', name: 'Nợ ngắn hạn', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '311', name: 'Ngắn hạn NCC', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '331', name: 'Phải trả người bán', expected: ACCOUNT_NATURES.BOTH, group: 'Nợ phải trả' },
    { code: '3311', name: 'Phải trả người bán (VN)', expected: ACCOUNT_NATURES.BOTH, group: 'Nợ phải trả' },
    { code: '333', name: 'Thuế và các khoản phải nộp', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '3331', name: 'Thuế GTGT phải nộp', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '3334', name: 'Thuế TNDN phải nộp', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '33311', name: 'Thuế GTGT đầu ra', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '334', name: 'Phải trả người lao động', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '338', name: 'Phải trả phải nộp khác', expected: ACCOUNT_NATURES.BOTH, group: 'Nợ phải trả' },
    { code: '3381', name: 'Phải trả phải nộp (chi tiết)', expected: ACCOUNT_NATURES.BOTH, group: 'Nợ phải trả' },
    { code: '341', name: 'Vay và nợ thuê TC', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },
    { code: '352', name: 'Dự phòng phải trả dài hạn', expected: ACCOUNT_NATURES.CREDIT, group: 'Nợ phải trả' },

    // NHÓM 4: VỐN CHỦ SỞ HỮU (CREDIT)
    { code: '410', name: 'Vốn chủ sở hữu', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '411', name: 'Vốn góp', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '412', name: 'Chênh lệch đánh giá lại', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '414', name: 'Quỹ đầu tư phát triển', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '418', name: 'Các quỹ khác', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '419', name: 'Cổ phiếu quỹ', expected: ACCOUNT_NATURES.DEBIT, group: 'Vốn chủ sở hữu' },
    { code: '421', name: 'Lợi nhuận sau thuế', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '4211', name: 'LNST chưa phân phối', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },
    { code: '430', name: 'Nguồn kinh phí', expected: ACCOUNT_NATURES.CREDIT, group: 'Vốn chủ sở hữu' },

    // NHÓM 5: DOANH THU (CREDIT)
    { code: '511', name: 'Doanh thu bán hàng', expected: ACCOUNT_NATURES.CREDIT, group: 'Doanh thu' },
    { code: '512', name: 'Doanh thu DV', expected: ACCOUNT_NATURES.CREDIT, group: 'Doanh thu' },
    { code: '515', name: 'Doanh thu Tài chính', expected: ACCOUNT_NATURES.CREDIT, group: 'Doanh thu' },

    // NHÓM 6: CHI PHÍ (DEBIT)
    { code: '611', name: 'Chi phí hao mòn', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '632', name: 'Giá vốn hàng bán', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '635', name: 'Chi phí bán hàng', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '641', name: 'Chi phí QLDN', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '642', name: 'Chi phí SXKD', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '711', name: 'Thu nhập khác', expected: ACCOUNT_NATURES.CREDIT, group: 'Chi phí' },
    { code: '811', name: 'Chi phí khác', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' },
    { code: '821', name: 'Chi phí thuế TNDN', expected: ACCOUNT_NATURES.DEBIT, group: 'Chi phí' }
  ];

  let currentGroup = '';
  allAccounts.forEach(acc => {
    if (acc.group !== currentGroup) {
      currentGroup = acc.group;
      console.log(`\n--- ${currentGroup} ---`);
    }
    
    const result = getAccountNature(acc.code);
    const passed = result === acc.expected;
    logTest(`${acc.code} - ${acc.name}`, passed, 
      passed ? `${acc.expected}` : `Expected ${acc.expected}, got ${result}`);
  });
}

// ============================================================================
// SECTION 2: COMPLEX BUSINESS SCENARIOS
// ============================================================================

async function testComplexBusinessScenarios() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 2: COMPLEX BUSINESS SCENARIOS                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Scenario 1: Account with both opening balance and transactions
  console.log('\n--- Scenario 1: Opening Balance + Transactions ---');
  const scenario1 = calculateNetBalance(1000, 500, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: DR 1000 + CR 500', 
    scenario1.netBalance === 500 && scenario1.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario1.netBalance} ${scenario1.balanceType}`);

  // Scenario 2: Account with opening balance on opposite side
  console.log('\n--- Scenario 2: Opening Balance Opposite Side ---');
  const scenario2 = calculateNetBalance(200, 1000, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Opening DR 200 + Transaction CR 1000 (exceptional)', 
    scenario2.netBalance === 800 && scenario2.balanceType === ACCOUNT_NATURES.CREDIT,
    `NET=${scenario2.netBalance} ${scenario2.balanceType}`);

  // Scenario 3: Zero balance
  console.log('\n--- Scenario 3: Zero Balance ---');
  const scenario3 = calculateNetBalance(0, 0, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Zero balance', 
    scenario3.netBalance === 0 && scenario3.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario3.netBalance} ${scenario3.balanceType}`);

  // Scenario 4: Equal debit and credit
  console.log('\n--- Scenario 4: Equal Debit and Credit ---');
  const scenario4 = calculateNetBalance(1000, 1000, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: DR=CR=1000', 
    scenario4.netBalance === 0 && scenario4.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario4.netBalance} ${scenario4.balanceType}`);

  // Scenario 5: Large numbers
  console.log('\n--- Scenario 5: Large Numbers ---');
  const scenario5 = calculateNetBalance(999999999999, 888888888888, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Large numbers (999B vs 888B)', 
    scenario5.netBalance === 111111111111 && scenario5.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario5.netBalance}`);

  // Scenario 6: Decimal amounts
  console.log('\n--- Scenario 6: Decimal Amounts ---');
  const scenario6 = calculateNetBalance(1000.50, 500.25, ACCOUNT_NATURES.DEBIT);
  logTest('DEBIT: Decimal amounts', 
    Math.abs(scenario6.netBalance - 500.25) < 0.01 && scenario6.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario6.netBalance}`);

  // Scenario 7: BOTH account - customer with multiple transactions
  console.log('\n--- Scenario 7: BOTH Account - Customer Transactions ---');
  const scenario7a = calculateNetBalance(5000, 2000, ACCOUNT_NATURES.BOTH);
  logTest('BOTH: Customer owes 5000, paid 2000', 
    scenario7a.netBalance === 3000 && scenario7a.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario7a.netBalance} ${scenario7a.balanceType} (Customer still owes)`);

  const scenario7b = calculateNetBalance(2000, 5000, ACCOUNT_NATURES.BOTH);
  logTest('BOTH: Customer paid 5000, owes 2000 (overpayment)', 
    scenario7b.netBalance === 3000 && scenario7b.balanceType === ACCOUNT_NATURES.CREDIT,
    `NET=${scenario7b.netBalance} ${scenario7b.balanceType} (Prepaid)`);

  // Scenario 8: CREDIT account - liability
  console.log('\n--- Scenario 8: CREDIT Account - Liability ---');
  const scenario8a = calculateNetBalance(3000, 5000, ACCOUNT_NATURES.CREDIT);
  logTest('CREDIT: Liability 5000, paid 3000', 
    scenario8a.netBalance === 2000 && scenario8a.balanceType === ACCOUNT_NATURES.CREDIT,
    `NET=${scenario8a.netBalance} ${scenario8a.balanceType}`);

  const scenario8b = calculateNetBalance(5000, 3000, ACCOUNT_NATURES.CREDIT);
  logTest('CREDIT: Liability 3000, paid 5000 (overpayment)', 
    scenario8b.netBalance === 2000 && scenario8b.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${scenario8b.netBalance} ${scenario8b.balanceType}`);
}

// ============================================================================
// SECTION 3: EDGE CASES & ERROR HANDLING
// ============================================================================

async function testEdgeCases() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 3: EDGE CASES & ERROR HANDLING                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Edge case 1: Null/undefined inputs
  console.log('\n--- Edge Case 1: Null/Undefined Inputs ---');
  const edge1 = calculateNetBalance(null, null, ACCOUNT_NATURES.DEBIT);
  logTest('NULL inputs', edge1.netBalance === 0 && edge1.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${edge1.netBalance}`);

  const edge2 = calculateNetBalance(undefined, undefined, ACCOUNT_NATURES.CREDIT);
  logTest('UNDEFINED inputs', edge2.netBalance === 0 && edge2.balanceType === ACCOUNT_NATURES.CREDIT,
    `NET=${edge2.netBalance}`);

  // Edge case 2: String inputs
  console.log('\n--- Edge Case 2: String Inputs ---');
  const edge3 = calculateNetBalance('1000', '500', ACCOUNT_NATURES.DEBIT);
  logTest('String inputs', edge3.netBalance === 500 && edge3.balanceType === ACCOUNT_NATURES.DEBIT,
    `NET=${edge3.netBalance}`);

  // Edge case 3: Negative numbers
  console.log('\n--- Edge Case 3: Negative Numbers ---');
  const edge4 = calculateNetBalance(-1000, -500, ACCOUNT_NATURES.DEBIT);
  logTest('Negative inputs', edge4.netBalance === 500 && edge4.balanceType === ACCOUNT_NATURES.CREDIT,
    `NET=${edge4.netBalance}`);

  // Edge case 4: Empty account code
  console.log('\n--- Edge Case 4: Empty Account Code ---');
  const edge5 = getAccountNature('');
  logTest('Empty string', edge5 === ACCOUNT_NATURES.DEBIT, `Got ${edge5}`);

  const edge6 = getAccountNature(null);
  logTest('Null account code', edge6 === ACCOUNT_NATURES.DEBIT, `Got ${edge6}`);

  // Edge case 5: Very long account code
  console.log('\n--- Edge Case 5: Very Long Account Code ---');
  const edge7 = getAccountNature('999999999999');
  logTest('Very long code', edge7 === ACCOUNT_NATURES.DEBIT, `Got ${edge7}`);

  // Edge case 6: Account code with leading zeros
  console.log('\n--- Edge Case 6: Leading Zeros ---');
  const edge8 = getAccountNature('0111');
  logTest('Leading zeros', edge8 === ACCOUNT_NATURES.DEBIT, `Got ${edge8}`);
}

// ============================================================================
// SECTION 4: BATCH PROCESSING
// ============================================================================

async function testBatchProcessing() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 4: BATCH PROCESSING (Multiple Accounts)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const batchAccounts = [
    { account_code: '111', debit: 1000, credit: 500 },
    { account_code: '112', debit: 2000, credit: 1000 },
    { account_code: '131', debit: 5000, credit: 2000 },
    { account_code: '331', debit: 1000, credit: 5000 },
    { account_code: '214', debit: 0, credit: 1000 },
    { account_code: '511', debit: 0, credit: 10000 },
    { account_code: '632', debit: 5000, credit: 0 }
  ];

  const results = calculateNetBalancesForAccounts(batchAccounts);

  console.log('\nBatch processing results:');
  results.forEach((r, idx) => {
    const passed = r.net_balance >= 0 && 
                   (r.balance_type === 'DEBIT' || r.balance_type === 'CREDIT') &&
                   (r.account_nature === 'DEBIT' || r.account_nature === 'CREDIT' || r.account_nature === 'BOTH');
    logTest(`Batch ${idx + 1}: ${r.account_code}`, passed,
      `NET=${r.net_balance} ${r.balance_type} (${r.account_nature})`);
  });
}

// ============================================================================
// SECTION 5: DATABASE INTEGRATION
// ============================================================================

async function testDatabaseIntegration() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 5: DATABASE INTEGRATION                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Check all account types in database
    console.log('\n--- Database Test 1: All Account Types ---');
    const typeCheck = await pool.query(`
      SELECT DISTINCT 
        SUBSTRING(account_code, 1, 1) as prefix,
        COUNT(*) as count,
        SUM(closing_debit) as total_dr,
        SUM(closing_credit) as total_cr,
        SUM(net_balance) as total_net,
        COUNT(CASE WHEN balance_type = 'DEBIT' THEN 1 END) as debit_count,
        COUNT(CASE WHEN balance_type = 'CREDIT' THEN 1 END) as credit_count
      FROM monthly_balances
      WHERE company_id = $1 AND year = $2
      GROUP BY SUBSTRING(account_code, 1, 1)
      ORDER BY prefix
    `, [TEST_COMPANY_ID, TEST_YEAR]);

    if (typeCheck.rows.length > 0) {
      console.log('\nAccount type distribution:');
      typeCheck.rows.forEach(row => {
        console.log(`  Prefix ${row.prefix}: ${row.count} accounts, ` +
                    `NET=${row.total_net} (${row.debit_count} DR, ${row.credit_count} CR)`);
      });
      logTest('Database has account data', true, 
        `${typeCheck.rows.length} different prefixes found`);
    } else {
      logTest('Database has account data', false, 'No data found');
    }

    // Test 2: Check BOTH accounts (131, 331, 138, 338)
    console.log('\n--- Database Test 2: BOTH Accounts ---');
    const bothCheck = await pool.query(`
      SELECT account_code, partner_id, closing_debit, closing_credit, 
             net_balance, balance_type
      FROM monthly_balances
      WHERE company_id = $1 AND year = $2
        AND account_code IN ('131', '331', '138', '338')
      LIMIT 20
    `, [TEST_COMPANY_ID, TEST_YEAR]);

    if (bothCheck.rows.length > 0) {
      logTest('BOTH accounts exist', true, `${bothCheck.rows.length} records found`);
      console.log('\nBOTH account samples:');
      bothCheck.rows.slice(0, 5).forEach(row => {
        console.log(`  ${row.account_code} (partner=${row.partner_id}): ` +
                    `DR=${row.closing_debit}, CR=${row.closing_credit}, ` +
                    `NET=${row.net_balance} ${row.balance_type}`);
      });
    } else {
      logTest('BOTH accounts exist', false, 'No BOTH accounts found');
    }

    // Test 3: Check special accounts (214, 229)
    console.log('\n--- Database Test 3: Special Credit Accounts ---');
    const specialCheck = await pool.query(`
      SELECT account_code, closing_debit, closing_credit, 
             net_balance, balance_type
      FROM monthly_balances
      WHERE company_id = $1 AND year = $2
        AND (account_code LIKE '214%' OR account_code LIKE '229%')
      LIMIT 10
    `, [TEST_COMPANY_ID, TEST_YEAR]);

    if (specialCheck.rows.length > 0) {
      logTest('Special credit accounts exist', true, `${specialCheck.rows.length} records found`);
      specialCheck.rows.slice(0, 3).forEach(row => {
        const correctType = row.balance_type === 'CREDIT';
        logTest(`${row.account_code} is CREDIT`, correctType,
          `balance_type=${row.balance_type}`);
      });
    } else {
      logTest('Special credit accounts exist', false, 'No special accounts found');
    }

    // Test 4: Verify NET balance calculation
    console.log('\n--- Database Test 4: NET Balance Calculation ---');
    const netCheck = await pool.query(`
      SELECT 
        account_code,
        closing_debit,
        closing_credit,
        net_balance,
        balance_type,
        CASE 
          WHEN balance_type = 'DEBIT' THEN closing_debit - closing_credit
          ELSE closing_credit - closing_debit
        END as expected_net
      FROM monthly_balances
      WHERE company_id = $1 AND year = $2
        AND net_balance > 0
      LIMIT 20
    `, [TEST_COMPANY_ID, TEST_YEAR]);

    if (netCheck.rows.length > 0) {
      let correctCount = 0;
      netCheck.rows.forEach(row => {
        const isCorrect = Math.abs(row.net_balance - row.expected_net) < 0.01;
        if (isCorrect) correctCount++;
      });
      logTest('NET balance calculation correct', 
        correctCount === netCheck.rows.length,
        `${correctCount}/${netCheck.rows.length} correct`);
    } else {
      logTest('NET balance calculation', false, 'No data to verify');
    }

  } catch (error) {
    logTest('Database integration', false, error.message);
  }
}

// ============================================================================
// SECTION 6: API INTEGRATION
// ============================================================================

async function testAPIIntegration() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 6: API INTEGRATION                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test all major account groups
    const testAccounts = [
      // Tài sản (DEBIT)
      '111', '112', '131', '138', '152', '156', '211', '214', '215', '229',
      // Nợ phải trả (CREDIT)
      '331', '333', '3331', '3334', '338', '341',
      // Vốn chủ sở hữu (CREDIT)
      '411', '414', '421',
      // Doanh thu (CREDIT)
      '511', '515',
      // Chi phí (DEBIT)
      '611', '632', '635', '641', '642', '811', '821'
    ];

    console.log(`\nTesting ${testAccounts.length} accounts via API...`);
    const results = await getPeriodBalanceSummary(TEST_COMPANY_ID, testAccounts, TEST_YEAR, 12);

    logTest('API returns results', results.length > 0, 
      `${results.length} accounts returned`);

    // Verify each account has required fields
    let allValid = true;
    results.forEach(r => {
      const hasRequired = 'account_code' in r && 
                          'debit' in r && 
                          'credit' in r && 
                          'net_balance' in r && 
                          'balance_type' in r &&
                          'account_nature' in r;
      if (!hasRequired) allValid = false;
    });
    logTest('All results have required fields', allValid);

    // Verify account natures
    let naturesCorrect = true;
    results.forEach(r => {
      const expected = getAccountNature(r.account_code);
      if (r.account_nature !== expected) {
        naturesCorrect = false;
        console.log(`  ❌ ${r.account_code}: expected ${expected}, got ${r.account_nature}`);
      }
    });
    logTest('Account natures correct', naturesCorrect);

    // Display summary
    console.log('\nAPI Results Summary:');
    const debitAccounts = results.filter(r => r.account_nature === 'DEBIT');
    const creditAccounts = results.filter(r => r.account_nature === 'CREDIT');
    const bothAccounts = results.filter(r => r.account_nature === 'BOTH');

    console.log(`  DEBIT accounts: ${debitAccounts.length}`);
    console.log(`  CREDIT accounts: ${creditAccounts.length}`);
    console.log(`  BOTH accounts: ${bothAccounts.length}`);

    // Show sample results
    console.log('\nSample results:');
    results.slice(0, 10).forEach(r => {
      console.log(`  ${r.account_code}: DR=${r.debit}, CR=${r.credit}, ` +
                   `NET=${r.net_balance} ${r.balance_type} (${r.account_nature})`);
    });

  } catch (error) {
    logTest('API integration', false, error.message);
  }
}

// ============================================================================
// SECTION 7: REAL-TIME BALANCE CALCULATION
// ============================================================================

async function testRealtimeBalance() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 7: REAL-TIME BALANCE CALCULATION                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    const testCases = [
      { account: '111', partner: null, type: 'DEBIT' },
      { account: '131', partner: 1, type: 'BOTH' },
      { account: '331', partner: 2, type: 'BOTH' },
      { account: '214', partner: null, type: 'CREDIT' }
    ];

    for (const tc of testCases) {
      console.log(`\n--- Testing ${tc.account} (${tc.type}) ---`);
      const balance = await getAccountBalance(TEST_COMPANY_ID, tc.account, tc.partner);

      if (tc.type === 'BOTH') {
        logTest(`${tc.account} returns dual balance`,
          typeof balance.debit_balance === 'number' && 
          typeof balance.credit_balance === 'number' &&
          balance.is_hermaphroditic === true,
          `DR=${balance.debit_balance}, CR=${balance.credit_balance}`);
      } else {
        logTest(`${tc.account} returns net balance`,
          typeof balance.balance === 'number' &&
          'balance_type' in balance &&
          'account_nature' in balance,
          `balance=${balance.balance}, type=${balance.balance_type}`);
      }
    }
  } catch (error) {
    logTest('Real-time balance', false, error.message);
  }
}

// ============================================================================
// SECTION 8: AGGREGATION SCENARIOS
// ============================================================================

async function testAggregationScenarios() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 8: AGGREGATION SCENARIOS                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Scenario: Multiple partners for BOTH account
  console.log('\n--- Scenario: Multiple Partners (131) ---');
  const multiPartner = [
    { account_code: '131', partner_id: 1, debit: 1000, credit: 500 },
    { account_code: '131', partner_id: 2, debit: 2000, credit: 1000 },
    { account_code: '131', partner_id: 3, debit: 500, credit: 1500 },
    { account_code: '131', partner_id: null, debit: 100, credit: 50 } // No partner
  ];

  const aggregated = calculateNetBalancesForAccounts(multiPartner);
  logTest('Multi-partner aggregation', aggregated.length === 4,
    `${aggregated.length} entries`);

  // Verify each partner calculated correctly
  aggregated.forEach((r, idx) => {
    const partner = multiPartner[idx].partner_id || 0;
    const expectedNet = r.debit - r.credit;
    const passed = r.net_balance === expectedNet || 
                   (r.debit < r.credit && r.net_balance === r.credit - r.debit);
    logTest(`Partner ${partner} (131)`, passed,
      `NET=${r.net_balance} ${r.balance_type}`);
  });

  // Scenario: Parent account aggregation
  console.log('\n--- Scenario: Parent Account (110 = 111 + 112) ---');
  const parentAccounts = [
    { account_code: '111', debit: 1000, credit: 200 },
    { account_code: '112', debit: 2000, credit: 500 }
  ];

  const parentAggregated = calculateNetBalancesForAccounts(parentAccounts);
  const totalNet = parentAggregated.reduce((sum, r) => sum + r.net_balance, 0);
  logTest('Parent account aggregation', totalNet === 2300,
    `Total NET=${totalNet} (111: ${parentAggregated[0].net_balance}, 112: ${parentAggregated[1].net_balance})`);
}

// ============================================================================
// SECTION 9: PERFORMANCE & STRESS TESTS
// ============================================================================

async function testPerformance() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 9: PERFORMANCE & STRESS TESTS                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Performance test 1: Batch processing 1000 accounts
  console.log('\n--- Performance Test 1: 1000 Accounts ---');
  const startTime = Date.now();
  const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
    account_code: String(100 + i),
    debit: Math.random() * 1000000,
    credit: Math.random() * 1000000
  }));

  const results = calculateNetBalancesForAccounts(largeBatch);
  const endTime = Date.now();
  const duration = endTime - startTime;

  logTest('Process 1000 accounts', results.length === 1000,
    `Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  logTest('Performance < 1s', duration < 1000, `${duration}ms`);

  // Performance test 2: getAccountNature 10000 calls
  console.log('\n--- Performance Test 2: 10000 Calls ---');
  const natureStart = Date.now();
  for (let i = 0; i < 10000; i++) {
    getAccountNature('131');
  }
  const natureEnd = Date.now();
  const natureDuration = natureEnd - natureStart;

  logTest('10000 getAccountNature calls', natureDuration < 1000,
    `Duration: ${natureDuration}ms`);
}

// ============================================================================
// SECTION 10: COMPATIBILITY & MIGRATION
// ============================================================================

async function testCompatibility() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SECTION 10: COMPATIBILITY & MIGRATION                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Test backward compatibility
  console.log('\n--- Backward Compatibility ---');
  
  // Old format: { patsinhDr, patsinhCr }
  const oldFormat = { patsinhDr: 1000, patsinhCr: 500 };
  const { calculateNetBalance: calcNet } = await import('./utils/accountNature.js');
  const result = calcNet(oldFormat.patsinhDr, oldFormat.patsinhCr, ACCOUNT_NATURES.DEBIT);
  
  logTest('Old format compatibility', result.netBalance === 500,
    `NET=${result.netBalance}`);

  // Test new format with account nature
  console.log('\n--- New Format with Account Nature ---');
  const newFormatResults = [
    { code: '111', nature: 'DEBIT', dr: 1000, cr: 500 },
    { code: '331', nature: 'CREDIT', dr: 500, cr: 1000 },
    { code: '131', nature: 'BOTH', dr: 2000, cr: 1000 }
  ];

  newFormatResults.forEach(item => {
    const net = calcNet(item.dr, item.cr, item.nature);
    logTest(`${item.code} (${item.nature})`, net.netBalance > 0,
      `NET=${net.netBalance} ${net.balanceType}`);
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE NET BALANCE TEST - ALL SCENARIOS           ║');
  console.log('║  Testing: All accounts + Complex business logic           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTest Company: ${TEST_COMPANY_ID}`);
  console.log(`Test Year: ${TEST_YEAR}`);
  console.log(`Started: ${new Date().toLocaleString('vi-VN')}\n`);

  try {
    await testAllAccountTypes();
    await testComplexBusinessScenarios();
    await testEdgeCases();
    await testBatchProcessing();
    await testDatabaseIntegration();
    await testAPIIntegration();
    await testRealtimeBalance();
    await testAggregationScenarios();
    await testPerformance();
    await testCompatibility();

    // Final summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL TEST SUMMARY                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal Tests: ${testResults.passed + testResults.failed}`);
    console.log(`✅ Passed: ${testResults.passed} (${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`\nCompleted: ${new Date().toLocaleString('vi-VN')}`);

    if (testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      testResults.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`  • ${t.testName}: ${t.message}`));
      process.exit(1);
    } else {
      console.log('\n✅ ALL TESTS PASSED!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
runAllTests();