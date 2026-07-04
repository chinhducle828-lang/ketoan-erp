import { pool } from '../config/db.js';

async function run() {
  try {
    const rs = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'items'
       ORDER BY ordinal_position`
    );
    console.log(JSON.stringify(rs.rows, null, 2));
  } catch (error) {
    console.error('SCHEMA_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
