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

async function checkVouchers() {
  const companyId = 18;
  
  try {
    console.log('🔍 Checking vouchers for company ID:', companyId);
    console.log('='.repeat(60));
    
    // Get vouchers
    const vouchers = await pool.query(
      'SELECT id, voucher_number, voucher_date, voucher_type, is_posted FROM vouchers WHERE company_id = $1',
      [companyId]
    );
    
    console.log(`\nFound ${vouchers.rows.length} vouchers:\n`);
    
    for (const voucher of vouchers.rows) {
      console.log(`Voucher #${voucher.id}: ${voucher.voucher_number}`);
      console.log(`  Date: ${voucher.voucher_date}, Type: ${voucher.voucher_type}, Posted: ${voucher.is_posted}`);
      
      // Get details
      const details = await pool.query(
        'SELECT account_code, entry_type, amount, partner_id FROM voucher_details WHERE voucher_id = $1',
        [voucher.id]
      );
      
      console.log(`  Details (${details.rows.length} lines):`);
      for (const detail of details.rows) {
        console.log(`    ${detail.entry_type} ${detail.account_code}: ${detail.amount} (partner: ${detail.partner_id || 'none'})`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkVouchers();