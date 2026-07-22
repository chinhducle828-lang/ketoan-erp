/**
 * Database Reset Script
 * Drops and recreates the database to fix schema issues
 * WARNING: This will delete all data!
 */

import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

const DB_NAME = process.env.DB_NAME || 'ketoan';

async function resetDatabase() {
  console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n🗑️  Starting database reset...\n');
  
  try {
    // Connect to postgres database to drop/create databases
    const adminPool = await pool;
    
    // Drop existing connections
    console.log('1. Terminating existing connections...');
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [DB_NAME]);
    
    // Drop database if exists
    console.log(`2. Dropping database ${DB_NAME}...`);
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
      console.log(`   ✅ Database ${DB_NAME} dropped`);
    } catch (err) {
      console.log(`   ⚠️  Could not drop database: ${err.message}`);
    }
    
    // Create database
    console.log(`3. Creating database ${DB_NAME}...`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`   ✅ Database ${DB_NAME} created`);
    
    // Close admin connection
    await adminPool.end();
    
    console.log('\n✅ Database reset complete!');
    console.log('   Start the server to initialize the schema: npm run dev\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database reset failed:', error.message);
    console.error('\n💡 Alternative: Manually drop and create the database:');
    console.error(`   psql -U postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"`);
    console.error(`   psql -U postgres -c "CREATE DATABASE ${DB_NAME};"\n`);
    process.exit(1);
  }
}

resetDatabase();