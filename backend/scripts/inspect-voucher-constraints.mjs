import { pool } from '../config/db.js';

async function run() {
  try {
    const rs = await pool.query(
      `SELECT c.conname, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON c.conrelid = t.oid
       WHERE t.relname = 'vouchers' AND c.contype = 'c'`
    );
    console.log(JSON.stringify(rs.rows, null, 2));
  } catch (error) {
    console.error('CONSTRAINT_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
