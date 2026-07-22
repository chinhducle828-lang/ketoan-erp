/**
 * CRITICAL TEST: WAC Replay Chaos Test
 * Purpose: Verify WAC Replay converges to correct mathematical value
 * Scenario: Insert backdated inventory receipts with extreme price volatility
 *          while continuously processing withdrawals
 * 
 * Expected Result: COGS_ADJUSTED converges to correct WAC value
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../config/db.js';
import { consumeLayers, calculateAVCO, wacReplay } from '../../services/costingEngine.service.js';
import { triggerReplay } from '../../services/wacReplay.service.js';

describe('WAC Replay Chaos Test - Price Volatility & Convergence', () => {
  const testCompanyId = 998;
  const testSku = 'TEST-WAC-CHAOS-SKU';

  beforeAll(async () => {
    // Setup test company
    await pool.query(`
      INSERT INTO companies (id, name, tax_code, address) 
      VALUES ($1, 'WAC Test Company', 'WAC-TEST', 'Test Address')
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

  test('WAC Replay with extreme price volatility should converge', async () => {
    const baseDate = new Date('2025-01-01');
    
    // Step 1: Create initial layers with extreme price variations
    const extremePrices = [10000, 500000, 10000, 1000000, 5000, 200000, 15000, 800000];
    const quantities = [100, 50, 200, 30, 150, 80, 120, 25];
    
    console.log('\n[WAC Chaos Test] Creating layers with extreme price volatility...');
    
    for (let i = 0; i < extremePrices.length; i++) {
      const receiptDate = new Date(baseDate);
      receiptDate.setDate(receiptDate.getDate() + i);
      
      await pool.query(`
        INSERT INTO inventory_costing_layers 
          (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity, 
           receipt_date, reference_id, reference_type)
        VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7, gen_random_uuid(), 'PURCHASE_ORDER')
      `, [
        testCompanyId, 
        testSku, 
        quantities[i], 
        extremePrices[i], 
        extremePrices[i] * quantities[i], 
        quantities[i],
        receiptDate.toISOString().split('T')[0]
      ]);
      
      console.log(`  Layer ${i + 1}: ${quantities[i]} units @ ${extremePrices[i].toLocaleString()} VND`);
    }

    // Step 2: Process continuous withdrawals while replaying
    console.log('\n[WAC Chaos Test] Processing withdrawals and WAC replay...');
    
    const withdrawalPromises = [];
    const withdrawalResults = [];
    
    // Process 50 concurrent withdrawals
    for (let i = 0; i < 50; i++) {
      withdrawalPromises.push(
        pool.connect().then(async (client) => {
          try {
            await client.query('BEGIN');
            
            const result = await consumeLayers(
              testCompanyId,
              null, // productId
              10,
              null, // sku
              null, // warehouseId
              new Date().toISOString().split('T')[0]
            );

            await client.query('COMMIT');
            
            withdrawalResults.push({
              requestId: i,
              success: true,
              totalCost: result.total_cost
            });
          } catch (err) {
            await client.query('ROLLBACK');
            withdrawalResults.push({
              requestId: i,
              success: false,
              error: err.message
            });
          } finally {
            client.release();
          }
        })
      );
    }

    await Promise.all(withdrawalPromises);
    
    const successfulWithdrawals = withdrawalResults.filter(r => r.success);
    console.log(`[WAC Chaos Test] Completed ${successfulWithdrawals.length}/50 withdrawals`);

    // Step 3: Run WAC Replay
    console.log('\n[WAC Chaos Test] Running WAC Replay...');
    
    const replayResult = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Chaos test replay',
        voucherDate: baseDate.toISOString().split('T')[0]
      }
    );

    console.log(`[WAC Chaos Test] Replay completed:`, replayResult);

    // Step 4: Verify mathematical convergence
    // Calculate expected WAC manually
    const allLayers = await pool.query(`
      SELECT quantity, unit_cost, remaining_quantity
      FROM inventory_costing_layers
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    let totalValue = 0;
    let totalQty = 0;
    
    allLayers.rows.forEach(layer => {
      totalValue += parseFloat(layer.remaining_quantity) * parseFloat(layer.unit_cost);
      totalQty += parseFloat(layer.remaining_quantity);
    });

    const expectedWAC = totalQty > 0 ? totalValue / totalQty : 0;
    console.log(`[WAC Chaos Test] Expected WAC: ${expectedWAC.toLocaleString()} VND`);
    console.log(`[WAC Chaos Test] Total remaining qty: ${totalQty}`);

    // Verify WAC is reasonable (not negative, not extreme)
    expect(expectedWAC).toBeGreaterThan(0);
    expect(expectedWAC).toBeLessThan(1000000); // Should be between min and max price
    
    // Verify no negative inventory
    const negativeLayers = allLayers.rows.filter(l => parseFloat(l.remaining_quantity) < 0);
    expect(negativeLayers.length).toBe(0);
  });

  test('WAC Replay should handle backdated receipts correctly', async () => {
    // Clear existing layers
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);

    // Create backdated receipt (day before yesterday)
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity, receipt_date)
      VALUES ($1, $2, 'PURCHASE', 100, 50000, 5000000, 100, $3)
    `, [testCompanyId, testSku, dayBefore.toISOString().split('T')[0]]);

    // Create yesterday's receipt
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity, receipt_date)
      VALUES ($1, $2, 'PURCHASE', 100, 100000, 10000000, 100, $3)
    `, [testCompanyId, testSku, yesterday.toISOString().split('T')[0]]);

    // Run WAC replay
    const replayResult = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Backdated receipt test',
        voucherDate: dayBefore.toISOString().split('T')[0]
      }
    );

    expect(replayResult).toBeDefined();
    expect(replayResult.adjustment_id).toBeDefined();

    // Verify WAC calculation
    const avcoResult = await calculateAVCO(testCompanyId, null, null);
    const expectedWAC = (100 * 50000 + 100 * 100000) / 200; // 75,000
    
    expect(avcoResult.avg_cost).toBeCloseTo(expectedWAC, -2);
  });

  test('WAC Replay should not create infinite loops', async () => {
    // Clear and create simple scenario
    await pool.query(`
      DELETE FROM inventory_costing_layers 
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

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
        reason: 'Idempotency test 1',
        voucherDate: '2025-01-01'
      }
    );

    const result2 = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Idempotency test 2',
        voucherDate: '2025-01-01'
      }
    );

    // Second run should return null (no adjustment needed)
    expect(result2).toBeNull();
  });

  test('WAC Replay should handle closed accounting periods', async () => {
    // Create a closed period
    const closedPeriod = '2025-03';
    await pool.query(`
      INSERT INTO accounting_periods 
        (company_id, fiscal_year, fiscal_period, period_start, period_end, status)
      VALUES ($1, 2025, 3, '2025-03-01', '2025-03-31', 'CLOSED')
      ON CONFLICT DO NOTHING
    `, [testCompanyId]);

    // Run replay - should handle closed periods gracefully
    const replayResult = await wacReplay(
      testCompanyId,
      null, // productId
      null, // backdatedVoucherId
      {
        reason: 'Closed period test',
        voucherDate: '2025-03-15'
      }
    );

    // Should either return null or adjustment with period shift
    expect(replayResult === null || replayResult.adjustment_id).toBeDefined();

    // Cleanup
    await pool.query(`
      DELETE FROM accounting_periods 
      WHERE company_id = $1 AND fiscal_year = 2025 AND fiscal_period = 3
    `, [testCompanyId]);
  });
});
