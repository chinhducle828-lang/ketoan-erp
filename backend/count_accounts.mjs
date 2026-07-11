import { pool } from './config/db.js';

try {
  const r = await pool.query('SELECT COUNT(*) as cnt FROM accounts');
  console.log('Tong so tai khoan trong bang accounts:', r.rows[0].cnt);
  
  const r2 = await pool.query('SELECT type, COUNT(*) as cnt FROM accounts GROUP BY type ORDER BY type');
  console.log('\nPhan bo theo loai:');
  r2.rows.forEach(row => console.log(`  ${row.type}: ${row.cnt}`));
  
  const r3 = await pool.query('SELECT COUNT(DISTINCT account_code) as cnt FROM voucher_details');
  console.log('\nSo tai khoan phat sinh (co trong voucher_details):', r3.rows[0].cnt);
  
  const r4 = await pool.query('SELECT COUNT(DISTINCT account_code) as cnt FROM monthly_balances');
  console.log('So tai khoan co so du thang (monthly_balances):', r4.rows[0].cnt);
  
  const r5 = await pool.query('SELECT COUNT(DISTINCT account_code) as cnt FROM opening_balances');
  console.log('So tai khoan co so du dau ky (opening_balances):', r5.rows[0].cnt);
  
  await pool.end();
} catch(e) {
  console.error('Loi:', e.message);
  await pool.end();
}