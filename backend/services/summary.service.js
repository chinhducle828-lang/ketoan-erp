/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module SummaryService
 * @description Dịch vụ truy vấn số dư và báo cáo tài chính (Financial Summary Service).
 * Cung cấp các hàm lấy số dư tài khoản theo kỳ, bảng cân đối phát sinh, và báo cáo tài chính.
 * 
 * @IMPORTANT Sử dụng Tier-1 (monthly_balances) khi có sẵn để tối ưu hiệu năng.
 * Fallback sang Tier-2 (voucher_details) nếu bảng monthly_balances chưa tồn tại.
 * Cả hai tier đều đã được fix để bao gồm số dư đầu kỳ (opening_balances).
 */
import { pool } from '../config/db.js';
import { getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';
import { calculateNetBalance } from '../utils/accountNature.js';

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
      WITH opening_balances_summary AS (
        SELECT
          account_code,
          SUM(opening_debit) AS ob_debit,
          SUM(opening_credit) AS ob_credit
        FROM opening_balances
        WHERE company_id = $1
          AND account_code = ANY(ARRAY[${placeholders}])
          AND fiscal_year = $${accountCodes.length + 2}
        GROUP BY account_code
      ),
      period_balance_summary AS (
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

    let paramCount = accountCodes.length + 3; // +3 because we added fiscal_year param
    if (year !== null) {
      fallbackQuery += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramCount}`;
    }
    if (month !== null) {
      fallbackQuery += ` AND EXTRACT(MONTH FROM v.voucher_date) = $${paramCount + (year !== null ? 1 : 0)}`;
    }

    fallbackQuery += `
        GROUP BY vd.account_code
      ),
      combined AS (
        SELECT
          COALESCE(vd.account_code, ob.account_code) AS account_code,
          COALESCE(ob.ob_debit, 0) + COALESCE(vd.debit_total, 0) AS debit_total,
          COALESCE(ob.ob_credit, 0) + COALESCE(vd.credit_total, 0) AS credit_total
        FROM period_balance_summary vd
        FULL OUTER JOIN opening_balances_summary ob
          ON vd.account_code = ob.account_code
      )
      SELECT
        account_code,
        debit_total,
        credit_total,
        (COALESCE(debit_total, 0) - COALESCE(credit_total, 0)) AS balance
      FROM combined
      ORDER BY account_code;
    `;

    query = fallbackQuery;
    values.push(year); // fiscal_year for opening_balances
    if (year !== null) values.push(year);
    if (month !== null) values.push(month);
  }

  const { rows } = await dbClient.query(query, values);

  return rows.map((row) => {
    const accountNature = getAccountNature(row.account_code);
    const { netBalance, balanceType } = calculateNetBalance(
      row.debit_total || 0,
      row.credit_total || 0,
      accountNature
    );

    return {
      account_code: row.account_code,
      debit: parseFloat(row.debit_total) || 0,
      credit: parseFloat(row.credit_total) || 0,
      balance: parseFloat(row.balance) || 0,
      net_balance: netBalance,
      balance_type: balanceType,
      account_nature: accountNature
    };
  });
}
