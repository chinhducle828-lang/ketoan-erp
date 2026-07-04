import { pool } from '../config/db.js';

async function run() {
  try {
    const vouchers = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'vouchers'
       ORDER BY ordinal_position`
    );

    const details = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'voucher_details'
       ORDER BY ordinal_position`
    );

    console.log('VOUCHERS_COLUMNS');
    console.log(JSON.stringify(vouchers.rows, null, 2));
    console.log('VOUCHER_DETAILS_COLUMNS');
    console.log(JSON.stringify(details.rows, null, 2));
  } catch (error) {
    console.error('SCHEMA_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
