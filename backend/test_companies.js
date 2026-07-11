import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ketoan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkCompanies() {
  try {
    console.log('🔍 Checking companies in database...');
    const result = await pool.query('SELECT id, name, tax_code FROM companies ORDER BY id');
    console.log(`✅ Found ${result.rows.length} companies:`);
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length > 0) {
      console.log('\n💡 Use company ID:', result.rows[0].id, 'for testing');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCompanies();