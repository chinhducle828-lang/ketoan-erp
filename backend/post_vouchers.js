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

async function postVouchers() {
  const companyId = 18;
  
  try {
    console.log('📝 Posting vouchers for company ID:', companyId);
    console.log('='.repeat(60));
    
    // Get unposted vouchers
    const vouchers = await pool.query(
      'SELECT id, voucher_number, voucher_date FROM vouchers WHERE company_id = $1 AND is_posted = FALSE',
      [companyId]
    );
    
    console.log(`\nFound ${vouchers.rows.length} unposted vouchers\n`);
    
    if (vouchers.rows.length === 0) {
      console.log('✅ All vouchers already posted');
      return;
    }
    
    // Post each voucher
    for (const voucher of vouchers.rows) {
      console.log(`Posting voucher #${voucher.id}: ${voucher.voucher_number} (${voucher.voucher_date})`);
      
      await pool.query(
        'UPDATE vouchers SET is_posted = TRUE, posted_at = NOW() WHERE id = $1',
        [voucher.id]
      );
      
      console.log(`  ✅ Posted successfully`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All vouchers posted successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

postVouchers();