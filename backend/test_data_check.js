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

async function checkData() {
  const companyId = 3;
  
  try {
    console.log('🔍 Checking data for company ID:', companyId);
    console.log('='.repeat(60));
    
    // Check opening_balances
    const openingResult = await pool.query(
      'SELECT COUNT(*) as count, MIN(fiscal_year) as min_year, MAX(fiscal_year) as max_year FROM opening_balances WHERE company_id = $1',
      [companyId]
    );
    console.log('\n1. OPENING BALANCES (Số dư đầu kỳ):');
    console.log(`   Count: ${openingResult.rows[0].count}`);
    console.log(`   Year range: ${openingResult.rows[0].min_year} - ${openingResult.rows[0].max_year}`);
    
    if (openingResult.rows[0].count > 0) {
      const sample = await pool.query(
        'SELECT * FROM opening_balances WHERE company_id = $1 LIMIT 3',
        [companyId]
      );
      console.log('   Sample:', JSON.stringify(sample.rows, null, 2));
    }
    
    // Check vouchers (header)
    const voucherResult = await pool.query(
      'SELECT COUNT(*) as count, MIN(voucher_date) as min_date, MAX(voucher_date) as max_date FROM vouchers WHERE company_id = $1',
      [companyId]
    );
    console.log('\n2. VOUCHERS (Chứng từ):');
    console.log(`   Count: ${voucherResult.rows[0].count}`);
    console.log(`   Date range: ${voucherResult.rows[0].min_date} - ${voucherResult.rows[0].max_date}`);
    
    // Check voucher_details
    const detailResult = await pool.query(
      'SELECT COUNT(*) as count FROM voucher_details WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = $1)',
      [companyId]
    );
    console.log(`   Detail lines: ${detailResult.rows[0].count}`);
    
    // Check monthly_balances
    const monthlyResult = await pool.query(
      'SELECT COUNT(*) as count, MIN(year) as min_year, MAX(year) as max_year FROM monthly_balances WHERE company_id = $1',
      [companyId]
    );
    console.log('\n3. MONTHLY BALANCES (Số dư tháng):');
    console.log(`   Count: ${monthlyResult.rows[0].count}`);
    console.log(`   Year range: ${monthlyResult.rows[0].min_year} - ${monthlyResult.rows[0].max_year}`);
    
    if (monthlyResult.rows[0].count > 0) {
      const sample = await pool.query(
        'SELECT * FROM monthly_balances WHERE company_id = $1 LIMIT 3',
        [companyId]
      );
      console.log('   Sample:', JSON.stringify(sample.rows, null, 2));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 Summary:');
    console.log(`   - Opening balances: ${openingResult.rows[0].count > 0 ? '✅ EXISTS' : '❌ EMPTY'}`);
    console.log(`   - Voucher details: ${voucherResult.rows[0].count > 0 ? '✅ EXISTS' : '❌ EMPTY'}`);
    console.log(`   - Monthly balances: ${monthlyResult.rows[0].count > 0 ? '✅ EXISTS' : '❌ EMPTY'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();