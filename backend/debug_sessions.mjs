/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config({ path: path.resolve('./.env') });
const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

try {
  const res = await pool.query('SELECT id, user_id, token, expires_at FROM sessions ORDER BY created_at DESC LIMIT 10');
  console.log(JSON.stringify(res.rows, null, 2));
} catch (err) {
  console.error('DB ERROR', err.message || err);
} finally {
  await pool.end();
}
