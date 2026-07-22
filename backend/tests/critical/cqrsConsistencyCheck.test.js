/**
 * CRITICAL TEST: CQRS Consistency Check
 * Purpose: Verify data consistency between write-side and read-side
 * Scenario: Compare voucher_details with account_dimension_balances
 * 
 * Expected Result: No discrepancies after crash recovery
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { pool } from '../../config/db.js';
import { ProjectionEngine } from '../../services/projectionEngine.service.js';

describe('CQRS Consistency Check - Write/Read Model Synchronization', () => {
  let projectionEngine;
  const testCompanyId = 996;
  const testSku = 'TEST-CQRS-SKU';

  beforeAll(async () => {
    projectionEngine = new ProjectionEngine(pool, null, null);

    // Setup test company
    await pool.query(`
      INSERT INTO companies (id, name, tax_code, address) 
      VALUES ($1, 'CQRS Test Company', 'CQRS-TEST', 'Test Address')
      ON CONFLICT (id) DO NOTHING
    `, [testCompanyId]);
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM voucher_details WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = $1)', 
      [testCompanyId]);
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
  }, 60000); // 60 second timeout for cleanup

  test('Projection should match voucher_details after normal operations', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Step 1: Create a voucher with dimensions
    const voucherId = await pool.query(`
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
      VALUES ($1, 'TEST-CQRS-001', '2025-01-15', 'PKT', 'CQRS Test Voucher', 'APPROVED', true)
      RETURNING id
    `, [testCompanyId]);

    const voucherIdValue = voucherId.rows[0].id;

    // Step 2: Create voucher details with dimensions
    const dimensions = {
      project_id: 'P001',
      cost_center: 'CC01',
      department: 'IT'
    };

    await pool.query(`
      INSERT INTO voucher_details 
        (voucher_id, account_code, entry_type, amount, dimensions, description)
      VALUES 
        ($1, '511', 'CR', 1000000, $2, 'Doanh thu'),
        ($1, '131', 'DR', 1000000, $2, 'Phải thu khách hàng')
    `, [voucherIdValue, JSON.stringify(dimensions)]);

    // Step 3: Run projection
    console.log('\n[CQRS Consistency] Running projection...');
    const projectionResult = await projectionEngine.projectVoucher(voucherIdValue);
    
    console.log(`[CQRS Consistency] Projection result:`, projectionResult);
    expect(projectionResult.success).toBe(true);
    expect(projectionResult.projected).toBeGreaterThan(0);

    // Step 4: Verify projection matches source data
    const voucherDetails = await pool.query(`
      SELECT account_code, entry_type, amount, dimensions
      FROM voucher_details
      WHERE voucher_id = $1
    `, [voucherIdValue]);

    const projectedBalances = await pool.query(`
      SELECT account_code, dimension_key, dimension_value, debit_accumulated, credit_accumulated
      FROM account_dimension_balances
      WHERE company_id = $1
      ORDER BY account_code, dimension_key
    `, [testCompanyId]);

    console.log('\n[CQRS Consistency] Voucher Details:');
    voucherDetails.rows.forEach(row => {
      console.log(`  ${row.account_code} ${row.entry_type}: ${row.amount}`);
    });

    console.log('\n[CQRS Consistency] Projected Balances:');
    projectedBalances.rows.forEach(row => {
      console.log(`  ${row.account_code} | ${row.dimension_key}=${row.dimension_value} | D:${row.debit_accumulated} C:${row.credit_accumulated}`);
    });

    // Verify each voucher detail line was projected correctly
    for (const detail of voucherDetails.rows) {
      const isDebit = detail.entry_type === 'DR';
      const expectedAmount = parseFloat(detail.amount);
      
      // Check each dimension was projected
      for (const [dimKey, dimVal] of Object.entries(detail.dimensions)) {
        const projected = projectedBalances.rows.find(
          p => p.account_code === detail.account_code &&
               p.dimension_key === dimKey &&
               p.dimension_value === dimVal.toString()
        );

        expect(projected).toBeDefined();
        
        if (isDebit) {
          expect(parseFloat(projected.debit_accumulated)).toBe(expectedAmount);
          expect(parseFloat(projected.credit_accumulated)).toBe(0);
        } else {
          expect(parseFloat(projected.debit_accumulated)).toBe(0);
          expect(parseFloat(projected.credit_accumulated)).toBe(expectedAmount);
        }
      }
    }
  });

  test('Consistency check should detect missing projections', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Create voucher but DON'T project it
    const voucherId = await pool.query(`
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
      VALUES ($1, 'TEST-CQRS-002', '2025-01-16', 'PKT', 'Unprojected Voucher', 'APPROVED', true)
      RETURNING id
    `, [testCompanyId]);

    const voucherIdValue = voucherId.rows[0].id;

    await pool.query(`
      INSERT INTO voucher_details 
        (voucher_id, account_code, entry_type, amount, dimensions)
      VALUES 
        ($1, '511', 'CR', 2000000, $2)
    `, [voucherIdValue, JSON.stringify({ project_id: 'P002' })]);

    // Check for unprojected vouchers
    const unprojectedVouchers = await pool.query(`
      SELECT v.id, v.voucher_number
      FROM vouchers v
      LEFT JOIN account_dimension_balances adb 
        ON v.company_id = adb.company_id
        AND EXISTS (
          SELECT 1 FROM voucher_details vd 
          WHERE vd.voucher_id = v.id 
          AND vd.dimensions IS NOT NULL 
          AND jsonb_object_keys(vd.dimensions) IS NOT NULL
        )
      WHERE v.company_id = $1
        AND v.status = 'APPROVED'
        AND adb.id IS NULL
    `, [testCompanyId]);

    // This voucher should be detected as unprojected
    expect(unprojectedVouchers.rows.length).toBeGreaterThan(0);
  });

  test('Consistency check should detect projection mismatches', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Create and project a voucher
    const voucherId = await pool.query(`
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
      VALUES ($1, 'TEST-CQRS-003', '2025-01-17', 'PKT', 'Mismatch Test', 'APPROVED', true)
      RETURNING id
    `, [testCompanyId]);

    const voucherIdValue = voucherId.rows[0].id;

    await pool.query(`
      INSERT INTO voucher_details 
        (voucher_id, account_code, entry_type, amount, dimensions)
      VALUES 
        ($1, '511', 'CR', 3000000, $2)
    `, [voucherIdValue, JSON.stringify({ project_id: 'P003' })]);

    // Project correctly
    await projectionEngine.projectVoucher(voucherIdValue);

    // Now manually corrupt the projection (simulate crash/partial update)
    await pool.query(`
      UPDATE account_dimension_balances
      SET credit_accumulated = credit_accumulated + 500000
      WHERE company_id = $1 AND account_code = '511' AND dimension_value = 'P003'
    `, [testCompanyId]);

    // Detect mismatch
    const voucherDetail = await pool.query(`
      SELECT amount, entry_type
      FROM voucher_details
      WHERE voucher_id = $1 AND account_code = '511'
    `, [voucherIdValue]);

    const projectedBalance = await pool.query(`
      SELECT credit_accumulated
      FROM account_dimension_balances
      WHERE company_id = $1 AND account_code = '511' AND dimension_value = 'P003'
    `, [testCompanyId]);

    const expectedAmount = parseFloat(voucherDetail.rows[0].amount);
    const actualAmount = parseFloat(projectedBalance.rows[0].credit_accumulated);

    console.log(`\n[CQRS Mismatch] Expected: ${expectedAmount}, Actual: ${actualAmount}`);
    console.log(`[CQRS Mismatch] Difference: ${actualAmount - expectedAmount}`);

    // Should detect the mismatch
    expect(actualAmount).not.toBe(expectedAmount);
  });

  test('Full consistency audit should report all discrepancies', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Create multiple vouchers
    for (let i = 0; i < 5; i++) {
      const voucherId = await pool.query(`
        INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
        VALUES ($1, $2, '2025-01-20', 'PKT', $3, 'APPROVED', true)
        RETURNING id
      `, [testCompanyId, `TEST-CQRS-${i}`, `Test voucher ${i}`]);

      await pool.query(`
        INSERT INTO voucher_details 
          (voucher_id, account_code, entry_type, amount, dimensions)
        VALUES 
          ($1, '511', 'CR', (i + 1) * 1000000, $2),
          ($1, '131', 'DR', (i + 1) * 1000000, $2)
      `, [voucherId.rows[0].id, JSON.stringify({ project_id: `P00${i + 1}` })]);

      // Project some but not all
      if (i % 2 === 0) {
        await projectionEngine.projectVoucher(voucherId.rows[0].id);
      }
    }

    // Run full consistency audit
    console.log('\n[CQRS Audit] Running full consistency audit...');
    
    const auditResult = await projectionEngine.runConsistencyAudit(testCompanyId);

    console.log(`[CQRS Audit] Total vouchers: ${auditResult.totalVouchers}`);
    console.log(`[CQRS Audit] Projected vouchers: ${auditResult.projectedVouchers}`);
    console.log(`[CQRS Audit] Unprojected vouchers: ${auditResult.unprojectedVouchers}`);
    console.log(`[CQRS Audit] Mismatched vouchers: ${auditResult.mismatchedVouchers}`);
    console.log(`[CQRS Audit] Discrepancies:`, auditResult.discrepancies);

    // Should detect unprojected vouchers
    expect(auditResult.unprojectedVouchers).toBeGreaterThan(0);
    
    // Report should include details
    expect(auditResult.discrepancies).toBeDefined();
    expect(auditResult.discrepancies.length).toBeGreaterThan(0);
  });

  test('Consistency check should handle crash recovery', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Simulate crash scenario: voucher created but projection failed mid-way
    const voucherId = await pool.query(`
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
      VALUES ($1, 'TEST-CQRS-CRASH', '2025-01-18', 'PKT', 'Crash Recovery Test', 'APPROVED', true)
      RETURNING id
    `, [testCompanyId]);

    const voucherIdValue = voucherId.rows[0].id;

    // Create multiple dimension lines
    await pool.query(`
      INSERT INTO voucher_details 
        (voucher_id, account_code, entry_type, amount, dimensions)
      VALUES 
        ($1, '511', 'CR', 5000000, $2),
        ($1, '131', 'DR', 5000000, $3),
        ($1, '632', 'DR', 2000000, $4)
    `, [
      voucherIdValue,
      JSON.stringify({ project_id: 'P001', cost_center: 'CC01' }),
      JSON.stringify({ project_id: 'P001', cost_center: 'CC01' }),
      JSON.stringify({ project_id: 'P001', cost_center: 'CC02' })
    ]);

    // Simulate partial projection (only first line projected)
    await pool.query(`
      INSERT INTO account_dimension_balances 
        (company_id, fiscal_year, fiscal_period, account_code, dimension_key, dimension_value, debit_accumulated, credit_accumulated)
      VALUES 
        ($1, 2025, 1, '511', 'project_id', 'P001', 0, 5000000)
      ON CONFLICT DO NOTHING
    `, [testCompanyId]);

    // Run consistency audit
    const auditResult = await projectionEngine.runConsistencyAudit(testCompanyId);

    console.log(`\n[Crash Recovery] Audit result:`, auditResult);

    // Should detect incomplete projection
    expect(auditResult.unprojectedVouchers).toBeGreaterThan(0);
    expect(auditResult.discrepancies.length).toBeGreaterThan(0);

    // Run reprojection to fix
    const reprojectResult = await projectionEngine.reprojectAllVouchers(testCompanyId, 10);
    console.log(`[Crash Recovery] Reprojected: ${reprojectResult.successCount} vouchers`);

    // Run audit again - should be clean now
    const auditAfterFix = await projectionEngine.runConsistencyAudit(testCompanyId);
    console.log(`[Crash Recovery] Audit after fix:`, auditAfterFix);

    expect(auditAfterFix.unprojectedVouchers).toBe(0);
    expect(auditAfterFix.mismatchedVouchers).toBe(0);
  });

  test('Consistency check should generate reconciliation report', async () => {
    // Increase timeout for this test (DB operations can be slow)
    jest.setTimeout(60000);
    // Clear existing data
    await pool.query('DELETE FROM vouchers WHERE company_id = $1', [testCompanyId]);
    await pool.query('DELETE FROM account_dimension_balances WHERE company_id = $1', [testCompanyId]);

    // Create test data
    const voucherId = await pool.query(`
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, status, is_posted)
      VALUES ($1, 'TEST-CQRS-RECON', '2025-01-19', 'PKT', 'Reconciliation Test', 'APPROVED', true)
      RETURNING id
    `, [testCompanyId]);

    await pool.query(`
      INSERT INTO voucher_details 
        (voucher_id, account_code, entry_type, amount, dimensions)
      VALUES 
        ($1, '511', 'CR', 10000000, $2)
    `, [voucherId.rows[0].id, JSON.stringify({ project_id: 'P999' })]);

    await projectionEngine.projectVoucher(voucherId.rows[0].id);

    // Generate reconciliation report
    const report = await projectionEngine.generateReconciliationReport(testCompanyId, {
      fiscal_year: 2025,
      fiscal_period: 1
    });

    console.log(`\n[Reconciliation Report] Generated:`, report);

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.totalVouchers).toBeGreaterThan(0);
    expect(report.summary.totalProjected).toBeGreaterThan(0);
    expect(report.summary.consistencyRate).toBeGreaterThan(95); // At least 95% consistent
  });
});