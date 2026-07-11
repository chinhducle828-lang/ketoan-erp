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

async function verifyResults() {
  const companyId = 18;
  const year = 2026;
  
  try {
    console.log('🔍 Verifying monthly_balances for company ID:', companyId);
    console.log('='.repeat(60));
    
    // Check monthly_balances
    const result = await pool.query(
      'SELECT * FROM monthly_balances WHERE company_id = $1 AND year = $2 ORDER BY month, account_code',
      [companyId, year]
    );
    
    console.log(`\nFound ${result.rows.length} monthly balance records:\n`);
    
    if (result.rows.length > 0) {
      console.log('Sample records:');
      console.log(JSON.stringify(result.rows.slice(0, 5), null, 2));
    }
    
    // Summary by month
    const monthSummary = await pool.query(
      `SELECT month, COUNT(*) as account_count, 
              SUM(closing_debit) as total_closing_debit,
              SUM(closing_credit) as total_closing_credit
       FROM monthly_balances 
       WHERE company_id = $1 AND year = $2 
       GROUP BY month ORDER BY month`,
      [companyId, year]
    );
    
    console.log('\n📊 Summary by month:');
    console.log(JSON.stringify(monthSummary.rows, null, 2));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyResults();