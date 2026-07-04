/**
 * Data Maintenance Service
 * Rebuild ledger, recalculate balances, repair data
 */
import { pool } from '../config/db.js';

export async function rebuildLedger(companyId, startDate) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tableCheck = await client.query("SELECT to_regclass('public.monthly_balances') AS table_name");
    const tableExists = Boolean(tableCheck.rows[0]?.table_name);

    if (!tableExists) {
      await client.query('COMMIT');
      return {
        success: true,
        message: 'Bảng monthly_balances chưa tồn tại trong cơ sở dữ liệu. Rebuild ledger đã bỏ qua bước cập nhật.',
        monthCount: 0
      };
    }

    await client.query('DELETE FROM monthly_balances WHERE company_id = $1', [companyId]);

    const { rowCount } = await client.query(
      `WITH period_rollup AS (
         SELECT
           DATE_TRUNC('month', v.voucher_date)::date AS period_start,
           vd.account_code,
           vd.partner_id,
           SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) AS debit_total,
           SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) AS credit_total
         FROM vouchers v
         JOIN voucher_details vd ON v.id = vd.voucher_id
         WHERE v.company_id = $1
           AND v.is_posted = TRUE
           AND v.voucher_date >= $2
         GROUP BY DATE_TRUNC('month', v.voucher_date)::date, vd.account_code, vd.partner_id
       )
       INSERT INTO monthly_balances (company_id, account_code, partner_id, month, year, closing_debit, closing_credit)
       SELECT
         $1,
         account_code,
         partner_id,
         EXTRACT(MONTH FROM period_start),
         EXTRACT(YEAR FROM period_start),
         debit_total,
         credit_total
       FROM period_rollup
       ON CONFLICT (company_id, account_code, COALESCE(partner_id, 0), month, year)
       DO UPDATE SET closing_debit = EXCLUDED.closing_debit,
                     closing_credit = EXCLUDED.closing_credit,
                     updated_at = NOW()`,
      [companyId, startDate]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Rebuild ledger thành công', monthCount: rowCount || 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default { rebuildLedger };
