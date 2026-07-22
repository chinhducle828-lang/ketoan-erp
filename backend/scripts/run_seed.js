/**
 * Run SQL seed file to populate system_configs
 */

import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  try {
    const sqlPath = path.join(__dirname, 'migrated_configs_seed.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🌱 Running SQL seed...');
    console.log('📄 File:', sqlPath);
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('✅ SQL seed executed successfully!');
    
    // Verify the data
    const result = await pool.query('SELECT COUNT(*) FROM system_configs');
    console.log(`📊 Total configs in database: ${result.rows[0].count}`);
    
    // Show some sample configs
    const sampleResult = await pool.query(`
      SELECT config_key, config_value, category, description 
      FROM system_configs 
      WHERE category = 'ACCOUNTS'
      LIMIT 5
    `);
    console.log('\n📋 Sample ACCOUNTS configs:');
    sampleResult.rows.forEach(row => {
      console.log(`  - ${row.config_key}: ${row.config_value} (${row.description})`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running seed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runSeed();