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

async function findCompanyWithData() {
  try {
    console.log('🔍 Searching for companies with data...\n');
    
    // Get all companies
    const companiesResult = await pool.query('SELECT id, name FROM companies ORDER BY id');
    
    console.log(`Found ${companiesResult.rows.length} total companies\n`);
    
    // Check each company for data
    for (const company of companiesResult.rows) {
      const result = await pool.query(
        `SELECT 
          (SELECT COUNT(*) FROM opening_balances WHERE company_id = $1) as opening_count,
          (SELECT COUNT(*) FROM vouchers WHERE company_id = $1) as voucher_count,
          (SELECT COUNT(*) FROM monthly_balances WHERE company_id = $1) as monthly_count`,
        [company.id]
      );
      
      const data = result.rows[0];
      const hasData = data.opening_count > 0 || data.voucher_count > 0 || data.monthly_count > 0;
      
      if (hasData) {
        console.log(`✅ Company ID ${company.id}: "${company.name}"`);
        console.log(`   - Opening balances: ${data.opening_count}`);
        console.log(`   - Vouchers: ${data.voucher_count}`);
        console.log(`   - Monthly balances: ${data.monthly_count}\n`);
      }
    }
    
    console.log('\n💡 Recommendation: Use a company with data for testing');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

findCompanyWithData();