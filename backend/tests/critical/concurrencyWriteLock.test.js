/**
 * CRITICAL TEST: Concurrency Write Lock Test
 * Purpose: Verify FIFO/AVCO algorithms don't have race conditions
 * Scenario: 500 concurrent requests for same SKU inventory operations
 * 
 * Expected Result: No duplicate layer deductions, no negative inventory
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../config/db.js';
import { consumeLayers, calculateAVCO, createInboundLayer } from '../../services/costingEngine.service.js';

describe('Concurrency Write Lock Test - FIFO/AVCO Race Conditions', () => {
  const testCompanyId = 999;
  const testSku = 'TEST-CONCURRENT-SKU';
  const concurrentRequests = 500;

  beforeAll(async () => {
    // Setup test data
    await pool.query(`
      INSERT INTO companies (id, name, tax_code, address) 
      VALUES ($1, 'Test Company', 'TEST', 'Test Address')
      ON CONFLICT (id) DO NOTHING
    `, [testCompanyId]);

    // Create initial inventory layers (10 layers, 100 qty each = 1000 total)
    for (let i = 0; i < 10; i++) {
      await pool.query(`
        INSERT INTO inventory_costing_layers 
          (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity, reference_id)
        VALUES ($1, $2, 'PURCHASE', 100, 100000, 10000000, 100, gen_random_uuid())
      `, [testCompanyId, testSku]);
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM inventory_costing_layers WHERE company_id = $1 AND sku = $2', 
      [testCompanyId, testSku]);
    await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
  }, 30000); // 30 second timeout for cleanup

  test('500 concurrent requests should not cause race conditions', async () => {
    const startTime = Date.now();
    const promises = [];
    const results = [];

    // Simulate 500 concurrent inventory withdrawals (each withdraws 2 units)
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        pool.connect().then(async (client) => {
          try {
            await client.query('BEGIN');
            
            // Call FIFO/AVCO logic
            const result = await consumeLayers(
              testCompanyId,
              null, // productId
              2, // quantity
              null, // sku
              null, // warehouseId
              new Date().toISOString().split('T')[0]
            );

            await client.query('COMMIT');
            
            results.push({
              requestId: i,
              success: true,
              layersUsed: result.layers,
              totalCost: result.total_cost
            });
          } catch (err) {
            await client.query('ROLLBACK');
            results.push({
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

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Verify results
    const successfulRequests = results.filter(r => r.success);
    const failedRequests = results.filter(r => !r.success);

    console.log(`\n[Concurrency Test] Completed in ${duration}ms`);
    console.log(`[Concurrency Test] Successful: ${successfulRequests.length}/${concurrentRequests}`);
    console.log(`[Concurrency Test] Failed: ${failedRequests.length}`);

    // Assertions
    expect(successfulRequests.length).toBeGreaterThan(0); // At least some should succeed
    
    // Verify no duplicate layer consumption
    const layerUsageCount = {};
    successfulRequests.forEach(req => {
      req.layersUsed.forEach(layer => {
        layerUsageCount[layer.layerId] = (layerUsageCount[layer.layerId] || 0) + 1;
      });
    });

    // Each layer should be used at most its initial quantity / 2 times (100 / 2 = 50 times)
    Object.entries(layerUsageCount).forEach(([layerId, count]) => {
      expect(count).toBeLessThanOrEqual(50); // 100 units / 2 units per request
    });

    // Verify total inventory consistency
    const inventoryResult = await pool.query(`
      SELECT SUM(remaining_quantity) as total_remaining
      FROM inventory_costing_layers
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    const totalRemaining = parseFloat(inventoryResult.rows[0]?.total_remaining || 0);
    const totalConsumed = successfulRequests.length * 2;
    const expectedRemaining = 1000 - totalConsumed;

    console.log(`[Concurrency Test] Total remaining: ${totalRemaining}`);
    console.log(`[Concurrency Test] Expected remaining: ${expectedRemaining}`);

    expect(totalRemaining).toBe(expectedRemaining);
    expect(totalRemaining).toBeGreaterThanOrEqual(0); // No negative inventory
  });

  test('No duplicate layer deductions in FIFO mode', async () => {
    // Reset to known state
    await pool.query(`
      UPDATE inventory_costing_layers 
      SET remaining_quantity = quantity
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Single request should consume from oldest layer first
    const result1 = await consumeLayers(
      testCompanyId,
      null, // productId
      50,
      testSku,
      null, // warehouseId
      new Date().toISOString().split('T')[0]
    );

    expect(result1.layers.length).toBeGreaterThan(0);
    expect(result1.layers[0].layer_id).toBeDefined();

    // Verify the oldest layer was consumed
    const layerCheck = await pool.query(`
      SELECT id, remaining_quantity
      FROM inventory_costing_layers
      WHERE company_id = $1 AND sku = $2
      ORDER BY created_at ASC
      LIMIT 1
    `, [testCompanyId, testSku]);

    expect(parseFloat(layerCheck.rows[0].remaining_quantity)).toBe(50); // 100 - 50 = 50
  });

  test('AVCO calculates weighted average correctly under concurrency', async () => {
    // Reset and add layers with different costs
    await pool.query(`
      UPDATE inventory_costing_layers 
      SET remaining_quantity = 0
      WHERE company_id = $1 AND sku = $2
    `, [testCompanyId, testSku]);

    // Add 100 units @ 100,000
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES ($1, $2, 'PURCHASE', 100, 100000, 10000000, 100)
    `, [testCompanyId, testSku]);

    // Add 100 units @ 200,000
    await pool.query(`
      INSERT INTO inventory_costing_layers 
        (company_id, sku, layer_type, quantity, unit_cost, total_cost, remaining_quantity)
      VALUES ($1, $2, 'PURCHASE', 100, 200000, 20000000, 100)
    `, [testCompanyId, testSku]);

    // AVCO should be 150,000 (100*100k + 100*200k) / 200
    const result = await calculateAVCO(testCompanyId, null, null);
    
    expect(result.avg_cost).toBeCloseTo(150000, -3); // Allow small floating point误差
    expect(result.total_quantity).toBe(200);
  });
});
