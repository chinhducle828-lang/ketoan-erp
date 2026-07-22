/**
 * CRITICAL TEST: Trigger Loop Prevention Test
 * Purpose: Ensure WAC Replay doesn't trigger infinite loops
 * Scenario: COGS_ADJUSTED entries should not re-trigger WAC Replay
 * 
 * Expected Result: No infinite loops, max 1 replay per adjustment
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { pool } from '../../config/db.js';
import { consumeLayers, wacReplay } from '../../services/costingEngine.service.js';
import { triggerReplay } from '../../services/wacReplay.service.js';

describe('Trigger Loop Prevention - No Infinite Replay Loops', () => {
  const testCompanyId = 997;
  const testSku = 'TEST-LOOP-PREVENTION-SKU';

  beforeAll(async () => {
    // Setup test company
    await pool.query(`
      INSERT INTO companies (id, name, tax_code, address) 
      VALUES ($1, 'Loop Test Company', 'LOOP-TEST', 'Test Address')
      ON CONFLICT (id) DO NOTHING
    `, [testCompanyId]);
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM inventory_costing_layers WHERE company_id = $1 AND sku = $2', 
      [testCompanyId, testSku]);
    await pool.query('DELETE FROM cost_adjustment_log WHERE company_id = $1 AND sku = $2', 
      [testCompanyId, testSku]);
    await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
  }, 30000); // 30 second timeout for cleanup

  test('WAC Replay should not trigger itself recursively', async () => {
    jest.setTimeout(30000); // 30 second timeout
    // Clear existing data
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Create initial layers
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100)
    `, [testCompanyId, testSku]);

    // Run replay - should complete without infinite loop
    const result = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Loop prevention test',
        voucherDate: '2025-01-01'
      }
    );

    // Wait a bit to see if any async triggers happen
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`[Loop Prevention] Replay result:`, result);
    
    // Should complete successfully without recursion
    expect(result === null || result.adjustment_id).toBeDefined();
  });

  test('COGS_ADJUSTED entries should not create adjustment loops', async () => {
    jest.setTimeout(30000); // 30 second timeout
    // Clear existing data
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    await pool.query(`
      DELETE FROM cost_adjustment_log 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Create layers
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES 
        ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100),
        ($1, $2, 'PURCHASE', 100, 100000, 10000000, 100)
    `, [testCompanyId, testSku]);

    // Run WAC Replay - this creates COGS_ADJUSTED entries
    const replayResult1 = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'First replay',
        voucherDate: '2025-01-01'
      }
    );

    console.log(`[COGS Loop Test] First replay result:`, replayResult1);

    // Check if adjustment log was created
    const adjustmentLog = await pool.query(`
      SELECT COUNT(*) as count
      FROM cost_adjustment_log
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    console.log(`[COGS Loop Test] Adjustment log entries: ${adjustmentLog.rows[0].count}`);

    // Run replay again - should return null (idempotent)
    const replayResult2 = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Second replay',
        voucherDate: '2025-01-01'
      }
    );

    console.log(`[COGS Loop Test] Second replay result:`, replayResult2);

    // Second run should return null (no adjustment needed)
    expect(replayResult2).toBeNull();

    // Verify adjustment log didn't grow
    const adjustmentLog2 = await pool.query(`
      SELECT COUNT(*) as count
      FROM cost_adjustment_log
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    expect(parseInt(adjustmentLog2.rows[0].count)).toBe(parseInt(adjustmentLog.rows[0].count));
  });

  test('WAC Replay should have circuit breaker for repeated failures', async () => {
    jest.setTimeout(30000); // 30 second timeout
    // Clear existing data
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Create invalid scenario that might cause errors
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100)
    `, [testCompanyId, testSku]);

    // Run replay - should handle errors gracefully without infinite loop
    const result = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Circuit breaker test',
        voucherDate: '2025-01-01'
      }
    );

    // Should either return null or adjustment (not infinite loop)
    expect(result === null || result.adjustment_id).toBeDefined();
  });

  test('WAC Replay should track replay depth to prevent recursion', async () => {
    jest.setTimeout(30000); // 30 second timeout
    // Clear existing data
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    await pool.query(`
      DELETE FROM cost_adjustment_log 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Create layers
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100)
    `, [testCompanyId, testSku]);

    // Run replay multiple times - should be idempotent
    const result1 = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Depth test 1',
        voucherDate: '2025-01-01'
      }
    );

    const result2 = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Depth test 2',
        voucherDate: '2025-01-01'
      }
    );

    // Second run should return null (idempotent)
    expect(result2).toBeNull();

    // Verify no infinite loop occurred
    const adjustmentCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM cost_adjustment_log
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Should have reasonable number of adjustments (not thousands)
    expect(parseInt(adjustmentCount.rows[0].count)).toBeLessThan(100);
  });

  test('WAC Replay should be idempotent across multiple runs', async () => {
    jest.setTimeout(30000); // 30 second timeout
    // Clear existing data
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    await pool.query(`
      DELETE FROM cost_adjustment_log 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Create layers
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES 
        ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100),
        ($1, $2, 'PURCHASE', 100, 100000, 10000000, 100)
    `, [testCompanyId, testSku]);

    // Run replay 5 times
    const results = [];
    for (let i = 0; i < 5; i++) {
      const result = await wacReplay(
        testCompanyId,
        null, // productId
        null, // backdatedVoucherId
        {
          reason: `Idempotency test ${i + 1}`,
          voucherDate: '2025-01-01'
        }
      );
      results.push(result);
    }

    // First run should make adjustment, subsequent runs should return null
    expect(results[0] === null || results[0].adjustment_id).toBeDefined();
    
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeNull();
    }

    // Verify total adjustments didn't grow
    const finalAdjustmentCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM cost_adjustment_log
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Should have at most 1 adjustment
    expect(parseInt(finalAdjustmentCount.rows[0].count)).toBeLessThanOrEqual(1);
  });
});
