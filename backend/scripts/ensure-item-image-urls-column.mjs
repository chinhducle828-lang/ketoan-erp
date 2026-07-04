import { pool } from '../config/db.js';

async function run() {
  try {
    await pool.query("ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'");
    console.log('MIGRATION_OK:image_urls');
  } catch (error) {
    console.error('MIGRATION_ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
