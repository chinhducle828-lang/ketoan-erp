/**
 * Test Script: Event Store Immutability Enforcement
 * ==================================================
 * Tests that event_store is truly immutable at database level
 */

import { pool } from '../config/db.js';

async function testImmutability() {
  console.log('🔒 Testing Event Store Immutability Enforcement\n');
  console.log('=' .repeat(60));

  let testEventId = null;
  let compensationEventId = null;

  try {
    // ========================================
    // Test 1: INSERT should work
    // ========================================
    console.log('\n✅ Test 1: INSERT event (should succeed)');
    const insertResult = await pool.query(`
      INSERT INTO event_store (
        event_type, category, company_id, event_data, metadata, severity, correlation_id
      ) VALUES (
        'TEST_IMMUTABILITY', 'system', 1,
        '{"test": "immutability"}',
        '{"test": true}',
        'info',
        'test_immutability_' || extract(epoch from now())::text
      )
      RETURNING id, event_type, timestamp
    `);
    
    testEventId = insertResult.rows[0].id;
    console.log(`   ✓ Created event ID: ${testEventId}`);
    console.log(`   ✓ Event type: ${insertResult.rows[0].event_type}`);
    console.log(`   ✓ Timestamp: ${insertResult.rows[0].timestamp}`);

    // ========================================
    // Test 2: UPDATE should FAIL
    // ========================================
    console.log('\n❌ Test 2: UPDATE event (should FAIL)');
    try {
      await pool.query(`
        UPDATE event_store 
        SET event_data = '{"hacked": true}'
        WHERE id = $1
      `, [testEventId]);
      
      console.log('   ✗ FAILED: UPDATE was allowed (immutability not enforced)');
      process.exitCode = 1;
    } catch (error) {
      if (error.message.includes('IMMUTABILITY_VIOLATION')) {
        console.log('   ✓ UPDATE correctly blocked');
        console.log(`   ✓ Error message: ${error.message.split('\n')[0]}`);
      } else {
        console.log(`   ✗ FAILED: Unexpected error: ${error.message}`);
        process.exitCode = 1;
      }
    }

    // ========================================
    // Test 3: DELETE should FAIL
    // ========================================
    console.log('\n❌ Test 3: DELETE event (should FAIL)');
    try {
      await pool.query(`
        DELETE FROM event_store 
        WHERE id = $1
      `, [testEventId]);
      
      console.log('   ✗ FAILED: DELETE was allowed (immutability not enforced)');
      process.exitCode = 1;
    } catch (error) {
      if (error.message.includes('IMMUTABILITY_VIOLATION')) {
        console.log('   ✓ DELETE correctly blocked');
        console.log(`   ✓ Error message: ${error.message.split('\n')[0]}`);
      } else {
        console.log(`   ✗ FAILED: Unexpected error: ${error.message}`);
        process.exitCode = 1;
      }
    }

    // ========================================
    // Test 4: Compensation event should work
    // ========================================
    console.log('\n✅ Test 4: Create compensation event (should succeed)');
    try {
      const compensateResult = await pool.query(`
        SELECT compensate_event($1, 'COMPENSATE_TEST_EVENT', '{"corrected": true}', 'Test compensation') as new_event_id
      `, [testEventId]);
      
      compensationEventId = compensateResult.rows[0].new_event_id;
      console.log(`   ✓ Created compensation event ID: ${compensationEventId}`);
      
      // Verify compensation event details
      const compEvent = await pool.query(`
        SELECT id, event_type, severity, metadata, correlation_id
        FROM event_store
        WHERE id = $1
      `, [compensationEventId]);
      
      const event = compEvent.rows[0];
      console.log(`   ✓ Event type: ${event.event_type}`);
      console.log(`   ✓ Severity: ${event.severity}`);
      console.log(`   ✓ Original event ID: ${event.metadata.original_event_id}`);
      console.log(`   ✓ Reason: ${event.metadata.reason}`);
      console.log(`   ✓ Is compensation: ${event.metadata.compensation}`);
      
      if (event.severity !== 'warning') {
        console.log('   ✗ FAILED: Compensation event should have severity=warning');
        process.exitCode = 1;
      }
    } catch (error) {
      console.log(`   ✗ FAILED: ${error.message}`);
      process.exitCode = 1;
    }

    // ========================================
    // Test 5: Get compensation chain
    // ========================================
    console.log('\n✅ Test 5: Get compensation chain (should show 2 events)');
    try {
      const chainResult = await pool.query(`
        SELECT * FROM get_event_compensation_chain($1)
        ORDER BY event_timestamp ASC
      `, [testEventId]);
      
      console.log(`   ✓ Chain length: ${chainResult.rows.length} events`);
      
      chainResult.rows.forEach((event, index) => {
        console.log(`   ${index + 1}. Event ID: ${event.event_id}`);
        console.log(`      Type: ${event.event_type}`);
        console.log(`      Is compensation: ${event.is_compensation}`);
        if (event.is_compensation) {
          console.log(`      Reason: ${event.compensation_reason}`);
        }
      });
      
      if (chainResult.rows.length !== 2) {
        console.log('   ✗ FAILED: Expected 2 events in chain');
        process.exitCode = 1;
      }
    } catch (error) {
      console.log(`   ✗ FAILED: ${error.message}`);
      process.exitCode = 1;
    }

    // ========================================
    // Test 6: Verify original event still exists
    // ========================================
    console.log('\n✅ Test 6: Verify original event still exists');
    try {
      const originalEvent = await pool.query(`
        SELECT id, event_type, event_data, timestamp
        FROM event_store
        WHERE id = $1
      `, [testEventId]);
      
      if (originalEvent.rows.length === 0) {
        console.log('   ✗ FAILED: Original event was deleted');
        process.exitCode = 1;
      } else {
        console.log('   ✓ Original event still exists');
        console.log(`   ✓ Event data unchanged: ${originalEvent.rows[0].event_data}`);
      }
    } catch (error) {
      console.log(`   ✗ FAILED: ${error.message}`);
      process.exitCode = 1;
    }

    // ========================================
    // Test 7: Compensation of non-existent event should fail
    // ========================================
    console.log('\n❌ Test 7: Compensate non-existent event (should FAIL)');
    try {
      await pool.query(`
        SELECT compensate_event(999999, 'COMPENSATE_TEST', '{}', 'Test')
      `);
      
      console.log('   ✗ FAILED: Should have raised error for non-existent event');
      process.exitCode = 1;
    } catch (error) {
      if (error.message.includes('COMPENSATION_ERROR')) {
        console.log('   ✓ Correctly raised error for non-existent event');
        console.log(`   ✓ Error message: ${error.message.split('\n')[0]}`);
      } else {
        console.log(`   ✗ FAILED: Unexpected error: ${error.message}`);
        process.exitCode = 1;
      }
    }

    // ========================================
    // Summary
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    
    if (process.exitCode === 1) {
      console.log('❌ Some tests FAILED');
      console.log('\nPlease check the errors above and fix any issues.');
    } else {
      console.log('✅ All tests PASSED');
      console.log('\nEvent Store is now immutable!');
      console.log('- UPDATE operations are blocked');
      console.log('- DELETE operations are blocked');
      console.log('- INSERT operations work normally');
      console.log('- Compensation events work correctly');
      console.log('\nNext steps:');
      console.log('1. Update eventStore.service.js to use compensation function');
      console.log('2. Update application code to handle IMMUTABILITY_VIOLATION errors');
      console.log('3. Proceed to Phase 2: External API Registry');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Unexpected error during testing:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Run tests
testImmutability();