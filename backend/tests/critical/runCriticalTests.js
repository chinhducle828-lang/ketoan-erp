/**
 * CRITICAL TEST RUNNER
 * Purpose: Execute all critical tests for Phase 5
 * Usage: node --experimental-vm-modules runCriticalTests.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const criticalTests = [
  {
    name: 'Concurrency Write Lock Test',
    file: 'backend/tests/critical/concurrencyWriteLock.test.js',
    description: 'Verify FIFO/AVCO algorithms handle 500 concurrent requests without race conditions',
    critical: true
  },
  {
    name: 'WAC Replay Chaos Test',
    file: 'backend/tests/critical/wacReplayChaos.test.js',
    description: 'Verify WAC Replay converges with extreme price volatility',
    critical: true
  },
  {
    name: 'Trigger Loop Prevention Test',
    file: 'backend/tests/critical/triggerLoopPrevention.test.js',
    description: 'Ensure no infinite loops in WAC Replay trigger chain',
    critical: true
  },
  {
    name: 'CQRS Consistency Check',
    file: 'backend/tests/critical/cqrsConsistencyCheck.test.js',
    description: 'Verify write-side and read-side data consistency',
    critical: true
  }
];

async function runTest(test) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 RUNNING: ${test.name}`);
  console.log(`📝 ${test.description}`);
  console.log(`⚠️  CRITICAL: ${test.critical ? 'YES' : 'NO'}`);
  console.log('='.repeat(80));

  try {
    const { stdout, stderr } = await execAsync(
      `node --experimental-vm-modules node_modules/jest/bin/jest.js ${test.file} --verbose --detectOpenHandles --forceExit`,
      {
        cwd: 'backend',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          KETOAN_TEST: '1'
        },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );

    console.log(stdout);
    if (stderr) {
      console.error('STDERR:', stderr);
    }

    // Check if test passed
    const passed = !stdout.includes('FAIL') && !stdout.includes('●');
    
    return {
      name: test.name,
      passed,
      output: stdout
    };

  } catch (error) {
    console.error(`❌ FAILED: ${test.name}`);
    console.error(error.stdout || error.message);
    
    return {
      name: test.name,
      passed: false,
      error: error.message,
      output: error.stdout || ''
    };
  }
}

async function runAllCriticalTests() {
  console.log('\n🚨 CRITICAL TEST SUITE - PHASE 5 CQRS PROJECTION ENGINE');
  console.log('='.repeat(80));
  console.log('⚠️  These tests verify system stability and data integrity');
  console.log('⚠️  ALL TESTS MUST PASS before production deployment');
  console.log('='.repeat(80));

  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const test of criticalTests) {
    const result = await runTest(test);
    results.push(result);

    if (result.passed) {
      passCount++;
      console.log(`\n✅ PASSED: ${test.name}\n`);
    } else {
      failCount++;
      console.log(`\n❌ FAILED: ${test.name}\n`);
    }

    // Wait between tests to avoid resource conflicts
    if (criticalTests.indexOf(test) < criticalTests.length - 1) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 CRITICAL TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${criticalTests.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / criticalTests.length) * 100).toFixed(2)}%`);
  console.log('='.repeat(80));

  // Detailed results
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('='.repeat(80));

  // Exit with appropriate code
  if (failCount > 0) {
    console.log('\n🚨 CRITICAL FAILURE: One or more critical tests failed!');
    console.log('❌ DO NOT DEPLOY TO PRODUCTION');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CRITICAL TESTS PASSED');
    console.log('✅ System is ready for production deployment');
    process.exit(0);
  }
}

// Run tests
runAllCriticalTests().catch(error => {
  console.error('Fatal error running critical tests:', error);
  process.exit(1);
});