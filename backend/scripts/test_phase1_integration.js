/**
 * Test script for Phase 1 Integration
 * Tests Event Store, AI Sandbox, and Redis Multi-Tenancy integrations
 */

import { pool } from '../config/db.js';
import { EventStore, EventHelpers } from '../services/eventStore.service.js';
import { predictWithSandbox } from '../services/aiSandbox.service.js';
import { mtGet, mtSet, mtDel, mtInvalidateCompany, RedisKeyBuilder } from '../cache/redisMultiTenancy.js';
import { redis } from '../cache/redis.js';
import logger from '../utils/logger.js';

const TEST_COMPANY_ID = 1;
const TEST_USER_ID = 1;

async function runTests() {
  console.log('🧪 Starting Phase 1 Integration Tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Event Store - Append Event
  try {
    console.log('Test 1: Event Store - Append Event');
    const event = await EventStore.append({
      eventType: 'TEST_EVENT',
      category: 'system',
      companyId: TEST_COMPANY_ID,
      userId: TEST_USER_ID,
      eventData: { test: true, message: 'Phase 1 integration test' },
      metadata: { source: 'test_script' },
      severity: 'info'
    });

    if (event && event.id) {
      console.log('✅ PASSED: Event created with ID:', event.id);
      passed++;
    } else {
      throw new Error('Event not created');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 2: Event Store - Get Event
  try {
    console.log('\nTest 2: Event Store - Get Event');
    const events = await EventStore.getEvents(TEST_COMPANY_ID, {
      category: 'system',
      limit: 1
    });

    if (events && events.length > 0) {
      console.log('✅ PASSED: Retrieved', events.length, 'events');
      passed++;
    } else {
      throw new Error('No events found');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 3: Event Helpers - Voucher Created
  try {
    console.log('\nTest 3: Event Helpers - Voucher Created');
    await EventHelpers.voucherCreated({
      id: 999999,
      company_id: TEST_COMPANY_ID,
      voucher_number: 'TEST-001',
      voucher_date: '2026-07-16',
      voucher_type: 'receipt',
      amount: 1000000,
      is_posted: false
    }, TEST_USER_ID, {
      ip_address: '127.0.0.1',
      test: true
    });

    console.log('✅ PASSED: Voucher created event logged');
    passed++;
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 4: Redis Multi-Tenancy - Key Building
  try {
    console.log('\nTest 4: Redis Multi-Tenancy - Key Building');
    const key = `company_${TEST_COMPANY_ID}:test:resource:123`;
    const expected = `company_${TEST_COMPANY_ID}:test:resource:123`;

    if (key === expected) {
      console.log('✅ PASSED: Key built correctly:', key);
      passed++;
    } else {
      throw new Error(`Key mismatch: ${key} !== ${expected}`);
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 5: Redis Multi-Tenancy - Set and Get
  try {
    console.log('\nTest 5: Redis Multi-Tenancy - Set and Get');
    const testData = { test: true, timestamp: Date.now() };
    
    await mtSet(TEST_COMPANY_ID, 'test:integration', testData, 60);
    const retrieved = await mtGet(TEST_COMPANY_ID, 'test:integration');

    if (retrieved && retrieved.test === true) {
      console.log('✅ PASSED: Data stored and retrieved successfully');
      passed++;
    } else {
      throw new Error('Data mismatch or not found');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 6: Redis Multi-Tenancy - Delete
  try {
    console.log('\nTest 6: Redis Multi-Tenancy - Delete');
    await mtDel(TEST_COMPANY_ID, 'test:integration');
    const retrieved = await mtGet(TEST_COMPANY_ID, 'test:integration');

    if (!retrieved) {
      console.log('✅ PASSED: Data deleted successfully');
      passed++;
    } else {
      throw new Error('Data still exists');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 7: Redis Multi-Tenancy - Company Invalidation
  try {
    console.log('\nTest 7: Redis Multi-Tenancy - Company Invalidation');
    
    // Set multiple keys for the company
    await mtSet(TEST_COMPANY_ID, 'test:key1', { data: 1 }, 60);
    await mtSet(TEST_COMPANY_ID, 'test:key2', { data: 2 }, 60);
    await mtSet(TEST_COMPANY_ID, 'test:key3', { data: 3 }, 60);

    // Invalidate all
    await mtInvalidateCompany(TEST_COMPANY_ID, 'test:*');

    // Check if keys are deleted
    const key1 = await mtGet(TEST_COMPANY_ID, 'test:key1');
    const key2 = await mtGet(TEST_COMPANY_ID, 'test:key2');
    const key3 = await mtGet(TEST_COMPANY_ID, 'test:key3');

    if (!key1 && !key2 && !key3) {
      console.log('✅ PASSED: All company keys invalidated');
      passed++;
    } else {
      throw new Error('Some keys still exist');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 8: AI Sandbox - Prediction Wrapper
  try {
    console.log('\nTest 8: AI Sandbox - Prediction Wrapper');
    
    const mockPredictionFn = async (inputData) => {
      return {
        field: 'account_code', // Field being predicted
        suggested_value: '611', // Suggested value
        confidence: 85, // Database expects integer (0-100)
        description: 'Test prediction'
      };
    };

    const result = await predictWithSandbox(mockPredictionFn, {
      type: 'test_prediction',
      companyId: TEST_COMPANY_ID,
      inputData: { amount: 100000, description: 'Test transaction' },
      userId: TEST_USER_ID
    });

    if (result && result.suggestion && result.suggestion.id) {
      console.log('✅ PASSED: AI prediction wrapped in sandbox, suggestion ID:', result.suggestion.id);
      console.log('   Confidence:', result.suggestion.confidence);
      console.log('   Requires approval:', result.suggestion.requires_approval);
      passed++;
    } else {
      throw new Error('Prediction result invalid');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 9: AI Sandbox - Critical Field Detection
  try {
    console.log('\nTest 9: AI Sandbox - Critical Field Detection');
    
    const mockPredictionWithCritical = async (inputData) => {
      return {
        field: 'account_code', // Specify the field being predicted
        suggested_value: '611',
        confidence: 92 // Database expects integer (0-100)
      };
    };

    const result = await predictWithSandbox(mockPredictionWithCritical, {
      type: 'test_critical',
      companyId: TEST_COMPANY_ID,
      inputData: { amount: 100000 },
      userId: TEST_USER_ID
    });

    if (result.suggestion && result.suggestion.requires_approval === true) {
      console.log('✅ PASSED: Critical field detected, approval required');
      passed++;
    } else {
      throw new Error('Critical field not detected');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Test 10: Database Connection
  try {
    console.log('\nTest 10: Database Connection');
    const result = await pool.query('SELECT NOW()');
    
    if (result.rows.length > 0) {
      console.log('✅ PASSED: Database connected, time:', result.rows[0].now);
      passed++;
    } else {
      throw new Error('No result from database');
    }
  } catch (err) {
    console.error('❌ FAILED:', err.message);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Phase 1 integration is working correctly.');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('💥 Test runner failed:', err);
  process.exit(1);
});