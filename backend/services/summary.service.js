import { pool } from '../config/db.js';

export function buildPeriodBalanceSummaryQuery(accountCodes, year = null, month = null) {
  const placeholders = accountCodes.map((_, idx) => `$${idx + 2}`).join(', ');
  let query = `
    WITH period_balance_summary AS (
      SELECT
        account_code,
        SUM(closing_debit) AS debit_total,
        SUM(closing_credit) AS credit_total
      FROM monthly_balances
      WHERE company_id = $1
        AND account_code = ANY(ARRAY[${placeholders}])
  `;

  const paramCount = accountCodes.length + 2;
  if (year !== null) {
    query += ` AND year = $${paramCount}`;
  }
  if (month !== null) {
    query += ` AND month = $${paramCount + (year !== null ? 1 : 0)}`;
  }

  query += `
      GROUP BY account_code
    )
    SELECT
      account_code,
      debit_total,
      credit_total,
      (COALESCE(debit_total, 0) - COALESCE(credit_total, 0)) AS balance
    FROM period_balance_summary
    ORDER BY account_code;
  `;

  return query;
}

export async function getPeriodBalanceSummary(companyId, accountCodes, year = null, month = null, dbClient = pool) {
  const tableCheck = await dbClient.query("SELECT to_regclass('public.monthly_balances') AS table_name");
  const tableExists = Boolean(tableCheck.rows[0]?.table_name);

  let query;
  const values = [companyId, ...accountCodes];

  if (tableExists) {
    query = buildPeriodBalanceSummaryQuery(accountCodes, year, month);
    if (year !== null) values.push(year);
    if (month !== null) values.push(month);
  } else {
    const placeholders = accountCodes.map((_, idx) => `$${idx + 2}`).join(', ');
    let fallbackQuery = `
      WITH period_balance_summary AS (
        SELECT
          vd.account_code,
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) AS debit_total,
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) AS credit_total
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1
          AND v.is_posted = TRUE
          AND vd.account_code = ANY(ARRAY[${placeholders}])
    `;

    let paramCount = accountCodes.length + 2;
    if (year !== null) {
      fallbackQuery += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramCount}`;
    }
    if (month !== null) {
      fallbackQuery += ` AND EXTRACT(MONTH FROM v.voucher_date) = $${paramCount + (year !== null ? 1 : 0)}`;
    }

    fallbackQuery += `
        GROUP BY vd.account_code
      )
      SELECT
        account_code,
        debit_total,
        credit_total,
        (COALESCE(debit_total, 0) - COALESCE(credit_total, 0)) AS balance
      FROM period_balance_summary
      ORDER BY account_code;
    `;

    query = fallbackQuery;
    if (year !== null) values.push(year);
    if (month !== null) values.push(month);
  }

  const { rows } = await dbClient.query(query, values);

  return rows.map((row) => ({
    account_code: row.account_code,
    debit: parseFloat(row.debit_total) || 0,
    credit: parseFloat(row.credit_total) || 0,
    balance: parseFloat(row.balance) || 0,
  }));
}
