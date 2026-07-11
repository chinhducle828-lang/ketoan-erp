/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module MaintenanceService
 * @description Dịch vụ bảo trì và tái lập sổ cái (Ledger Maintenance).
 * Cung cấp các công cụ rebuild monthly_balances với số dư đầu kỳ, validation, và single-month update.
 * 
 * @IMPORTANT Đây là module cốt lõi đảm bảo tính toàn vẹn dữ liệu kế toán theo chuẩn Thông tư 99/2025/TT-BTC.
 */
import { pool } from '../config/db.js';
import { getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';
import { calculateNetBalance } from '../utils/accountNature.js';

/**
 * Iterative monthly_balances rebuild with opening balance integration
 * 
 * Flow: Month 1 = opening_balances + January transactions
 *       Month N = Month(N-1) closing + Month N transactions
 *       FULL OUTER JOIN ensures accounts with balance but zero transactions are preserved
 * 
 * @param {number} companyId - ID công ty
 * @param {number} fiscalYear - Năm tài chính
 * @param {number|null} startMonth - Tháng bắt đầu rebuild (1-12). null = rebuild từ đầu năm
 * @returns {Promise<{success: boolean, message: string, monthCount: number, details: Array}>}
 */
export async function rebuildLedger(companyId, fiscalYear, startMonth = null) {
  const client = await pool.connect();
  const firstMonth = startMonth || 1;
  const details = [];

  try {
    // 1. Kiểm tra bảng monthly_balances đã tồn tại chưa
    const tableCheck = await client.query("SELECT to_regclass('public.monthly_balances') AS table_name");
    const tableExists = Boolean(tableCheck.rows[0]?.table_name);

    if (!tableExists) {
      return {
        success: true,
        message: 'Bảng monthly_balances chưa tồn tại trong cơ sở dữ liệu. Rebuild ledger đã bỏ qua.',
        monthCount: 0,
        details: []
      };
    }

    // 2. Bắt đầu transaction
    await client.query('BEGIN');

    // 3. Xóa dữ liệu cũ từ tháng bắt đầu → 12
    const deleteResult = await client.query(
      `DELETE FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month >= $3`,
      [companyId, fiscalYear, firstMonth]
    );
    console.log(`[rebuildLedger] Deleted ${deleteResult.rowCount} rows for company=${companyId}, year=${fiscalYear}, from month=${firstMonth}`);

    // 4. Vòng lặp tháng 1 → 12
    for (let month = firstMonth; month <= 12; month++) {
      const monthStart = process.hrtime.bigint();

      // Lấy số dư nền (Base Balance) cho tháng hiện tại
      const baseQuery = month === 1
        ? // Tháng 1: Lấy số dư đầu kỳ từ bảng opening_balances
          `SELECT account_code, COALESCE(partner_id, 0) AS partner_id, 
                  opening_debit AS base_debit, opening_credit AS base_credit
           FROM opening_balances
           WHERE company_id = $1 AND fiscal_year = $2`
        : // Tháng > 1: Lấy số dư cuối kỳ tháng trước từ bảng monthly_balances
          `SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
                  closing_debit AS base_debit, closing_credit AS base_credit
           FROM monthly_balances
           WHERE company_id = $1 AND year = $2 AND month = $3`;

      const baseParams = month === 1
        ? [companyId, fiscalYear]
        : [companyId, fiscalYear, month - 1];

      // Lấy tổng phát sinh trong tháng
      const transQuery = `
        SELECT 
          vd.account_code,
          COALESCE(vd.partner_id, 0) AS partner_id,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END), 0) AS trans_debit,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END), 0) AS trans_credit
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE v.company_id = $1
          AND v.is_posted = TRUE
          AND EXTRACT(YEAR FROM v.voucher_date) = $2
          AND EXTRACT(MONTH FROM v.voucher_date) = $3
        GROUP BY vd.account_code, vd.partner_id
      `;

      // Kết hợp base_balances và transactions bằng FULL OUTER JOIN
      // Tính toán net_balance và balance_type dựa trên tính chất tài khoản
      const mergeQuery = `
        WITH base_balances AS (
          ${baseQuery}
        ),
        current_transactions AS (
          ${transQuery}
        ),
        combined AS (
          SELECT
            COALESCE(b.account_code, t.account_code) AS account_code,
            COALESCE(b.partner_id, t.partner_id) AS partner_id,
            COALESCE(b.base_debit, 0) + COALESCE(t.trans_debit, 0) AS closing_debit,
            COALESCE(b.base_credit, 0) + COALESCE(t.trans_credit, 0) AS closing_credit
          FROM base_balances b
          FULL OUTER JOIN current_transactions t
            ON b.account_code = t.account_code AND b.partner_id = t.partner_id
        ),
        with_net_balance AS (
          SELECT 
            account_code,
            partner_id,
            closing_debit,
            closing_credit,
            CASE 
              WHEN get_account_nature(account_code) = 'DEBIT' THEN 
                CASE WHEN (closing_debit - closing_credit) >= 0 THEN closing_debit - closing_credit ELSE 0 END
              WHEN get_account_nature(account_code) = 'CREDIT' THEN 
                CASE WHEN (closing_credit - closing_debit) >= 0 THEN closing_credit - closing_debit ELSE 0 END
              ELSE 
                GREATEST(closing_debit - closing_credit, closing_credit - closing_debit)
            END AS net_balance,
            CASE 
              WHEN get_account_nature(account_code) = 'DEBIT' THEN 
                CASE WHEN (closing_debit - closing_credit) >= 0 THEN 'DEBIT' ELSE 'CREDIT' END
              WHEN get_account_nature(account_code) = 'CREDIT' THEN 
                CASE WHEN (closing_credit - closing_debit) >= 0 THEN 'CREDIT' ELSE 'DEBIT' END
              ELSE 
                CASE WHEN (closing_debit - closing_credit) >= 0 THEN 'DEBIT' ELSE 'CREDIT' END
            END AS balance_type
          FROM combined
        )
        INSERT INTO monthly_balances (company_id, account_code, partner_id, month, year, closing_debit, closing_credit, net_balance, balance_type)
        SELECT $4, account_code, NULLIF(partner_id, 0), $5, $6, closing_debit, closing_credit, net_balance, balance_type
        FROM with_net_balance
        WHERE closing_debit != 0 OR closing_credit != 0
        ON CONFLICT (company_id, account_code, COALESCE(partner_id, 0), month, year)
        DO UPDATE SET 
          closing_debit = EXCLUDED.closing_debit,
          closing_credit = EXCLUDED.closing_credit,
          net_balance = EXCLUDED.net_balance,
          balance_type = EXCLUDED.balance_type,
          updated_at = NOW()
      `;

      const mergeParams = [
        companyId, fiscalYear, month, // params 1-3 for subqueries
        companyId, month, fiscalYear  // params 4-6 for INSERT
      ];
      
      // Add PostgreSQL function for get_account_nature if not exists
      await client.query(`
        CREATE OR REPLACE FUNCTION get_account_nature(account_code VARCHAR)
        RETURNS VARCHAR AS $$
        BEGIN
          -- Check exceptions first (exact match)
          IF account_code IN ('131', '331', '138', '338') THEN
            RETURN 'BOTH';
          END IF;
          
          -- Check parent codes for sub-accounts
          IF LEFT(account_code, 3) IN ('131', '331', '138', '338') THEN
            RETURN 'BOTH';
          END IF;
          
          -- Special cases: Contra-asset (dư Có)
          IF account_code IN ('214', '229') OR LEFT(account_code, 3) IN ('214', '229') THEN
            RETURN 'CREDIT';
          END IF;
          
          -- Special cases: Contra-equity (dư Nợ) - Cổ phiếu quỹ
          IF account_code IN ('419') OR LEFT(account_code, 3) IN ('419') THEN
            RETURN 'DEBIT';
          END IF;
          
          -- Prefix rules
          IF LEFT(account_code, 1) IN ('1', '2', '6', '8', '9') THEN
            RETURN 'DEBIT';
          ELSIF LEFT(account_code, 1) IN ('3', '4', '5', '7') THEN
            RETURN 'CREDIT';
          END IF;
          
          -- Default
          RETURN 'DEBIT';
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
      `);

      const mergeResult = await client.query(mergeQuery, mergeParams);

      const monthEnd = process.hrtime.bigint();
      const elapsedMs = Number(monthEnd - monthStart) / 1_000_000;

      details.push({
        month,
        rows_affected: mergeResult.rowCount,
        elapsed_ms: Math.round(elapsedMs)
      });
    }

    // 5. Commit transaction - toàn bộ hoặc không gì cả
    await client.query('COMMIT');

    // 6. Xóa cache liên quan
    try {
      const { invalidateCache } = await import('../cache/redis.js');
      await invalidateCache(`dashboard:cashflow:${companyId}:${fiscalYear}:*`);
      await invalidateCache(`balance-sheet:${companyId}:${fiscalYear}:*`);
    } catch (cacheError) {
      console.warn('[rebuildLedger] Cache invalidation warning:', cacheError.message);
    }

    const totalRows = details.reduce((sum, d) => sum + d.rows_affected, 0);

    return {
      success: true,
      message: `Rebuild ledger thành công cho năm ${fiscalYear}, từ tháng ${firstMonth} → 12.`,
      monthCount: totalRows,
      details
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[rebuildLedger] Lỗi rebuild ledger:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cập nhật monthly_balances cho một tháng cụ thể (dùng sau closing)
 * 
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng cần cập nhật
 * @param {number} year - Năm
 * @param {object} dbClient - Database client đang trong transaction
 */
export async function updateMonthlyBalanceForMonth(companyId, month, year, dbClient) {
  if (!dbClient) {
    throw new Error('[updateMonthlyBalanceForMonth] Yêu cầu dbClient đang trong transaction');
  }

  // Xóa dữ liệu tháng hiện tại
  await dbClient.query(
    `DELETE FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = $3`,
    [companyId, year, month]
  );

  if (month === 1) {
    // Tháng 1: opening_balances + transactions
    await dbClient.query(`
      WITH base_balances AS (
        SELECT account_code, COALESCE(partner_id, 0) AS partner_id, 
               opening_debit AS base_debit, opening_credit AS base_credit
        FROM opening_balances
        WHERE company_id = $1 AND fiscal_year = $2
      ),
      current_transactions AS (
        SELECT 
          vd.account_code, COALESCE(vd.partner_id, 0) AS partner_id,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END), 0) AS trans_debit,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END), 0) AS trans_credit
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE v.company_id = $1 AND v.is_posted = TRUE
          AND EXTRACT(YEAR FROM v.voucher_date) = $2
          AND EXTRACT(MONTH FROM v.voucher_date) = $3
        GROUP BY vd.account_code, vd.partner_id
      ),
      combined AS (
        SELECT
          COALESCE(b.account_code, t.account_code) AS account_code,
          COALESCE(b.partner_id, t.partner_id) AS partner_id,
          COALESCE(b.base_debit, 0) + COALESCE(t.trans_debit, 0) AS closing_debit,
          COALESCE(b.base_credit, 0) + COALESCE(t.trans_credit, 0) AS closing_credit
        FROM base_balances b
        FULL OUTER JOIN current_transactions t ON b.account_code = t.account_code AND b.partner_id = t.partner_id
      )
      INSERT INTO monthly_balances (company_id, account_code, partner_id, month, year, closing_debit, closing_credit)
      SELECT $1, account_code, NULLIF(partner_id, 0), $3, $2, closing_debit, closing_credit
      FROM combined
      ON CONFLICT (company_id, account_code, COALESCE(partner_id, 0), month, year)
      DO UPDATE SET closing_debit = EXCLUDED.closing_debit, closing_credit = EXCLUDED.closing_credit, updated_at = NOW()
    `, [companyId, year, month]);
  } else {
    // Tháng > 1: tháng trước + transactions
    await dbClient.query(`
      WITH base_balances AS (
        SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
               closing_debit AS base_debit, closing_credit AS base_credit
        FROM monthly_balances
        WHERE company_id = $1 AND year = $2 AND month = $3
      ),
      current_transactions AS (
        SELECT 
          vd.account_code, COALESCE(vd.partner_id, 0) AS partner_id,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END), 0) AS trans_debit,
          COALESCE(SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END), 0) AS trans_credit
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE v.company_id = $1 AND v.is_posted = TRUE
          AND EXTRACT(YEAR FROM v.voucher_date) = $2
          AND EXTRACT(MONTH FROM v.voucher_date) = $4
        GROUP BY vd.account_code, vd.partner_id
      ),
      combined AS (
        SELECT
          COALESCE(b.account_code, t.account_code) AS account_code,
          COALESCE(b.partner_id, t.partner_id) AS partner_id,
          COALESCE(b.base_debit, 0) + COALESCE(t.trans_debit, 0) AS closing_debit,
          COALESCE(b.base_credit, 0) + COALESCE(t.trans_credit, 0) AS closing_credit
        FROM base_balances b
        FULL OUTER JOIN current_transactions t ON b.account_code = t.account_code AND b.partner_id = t.partner_id
      )
      INSERT INTO monthly_balances (company_id, account_code, partner_id, month, year, closing_debit, closing_credit)
      SELECT $1, account_code, NULLIF(partner_id, 0), $4, $2, closing_debit, closing_credit
      FROM combined
      ON CONFLICT (company_id, account_code, COALESCE(partner_id, 0), month, year)
      DO UPDATE SET closing_debit = EXCLUDED.closing_debit, closing_credit = EXCLUDED.closing_credit, updated_at = NOW()
    `, [companyId, year, month - 1, month]);
  }
}

/**
 * Kiểm tra tính toàn vẹn dữ liệu monthly_balances
 * 
 * @param {number} companyId - ID công ty
 * @param {number} year - Năm tài chính
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[], details: object}>}
 */
export async function validateMonthlyBalances(companyId, year) {
  const client = await pool.connect();

  try {
    const errors = [];
    const warnings = [];
    const accountChecks = [];

    // Kiểm tra bảng monthly_balances có tồn tại không
    const tableCheck = await client.query("SELECT to_regclass('public.monthly_balances') AS table_name");
    if (!tableCheck.rows[0]?.table_name) {
      return { valid: false, errors: ['Bảng monthly_balances chưa tồn tại'], warnings: [], details: null };
    }

    // 1. Kiểm tra khoảng trống tháng (month gaps)
    const monthGapCheck = await client.query(`
      SELECT DISTINCT month FROM monthly_balances 
      WHERE company_id = $1 AND year = $2 
      ORDER BY month
    `, [companyId, year]);
    const existingMonths = monthGapCheck.rows.map(r => r.month);
    
    for (let m = 1; m <= 12; m++) {
      if (!existingMonths.includes(m)) {
        // Kiểm tra có dữ liệu gốc không (opening balances hoặc vouchers)
        if (m === 1) {
          const hasOpening = await client.query(
            `SELECT 1 FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 LIMIT 1`,
            [companyId, year]
          );
          if (hasOpening.rows.length > 0) {
            errors.push(`Tháng ${m}/${year}: Có số dư đầu kỳ nhưng không có dòng nào trong monthly_balances`);
          }
        }
        
        const hasVouchers = await client.query(
          `SELECT 1 FROM vouchers WHERE company_id = $1 
           AND is_posted = TRUE 
           AND EXTRACT(YEAR FROM voucher_date) = $2 
           AND EXTRACT(MONTH FROM voucher_date) = $3 
           LIMIT 1`,
          [companyId, year, m]
        );
        if (hasVouchers.rows.length > 0) {
          errors.push(`Tháng ${m}/${year}: Có chứng từ đã ghi sổ nhưng không có dòng nào trong monthly_balances`);
        }
      }
    }

    // 2. Kiểm tra tháng 1 = opening_balances + transactions
    if (existingMonths.includes(1)) {
      const janCheck = await client.query(`
        WITH ob_summary AS (
          SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
                 opening_debit, opening_credit
          FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2
        ),
        mb_summary AS (
          SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
                 closing_debit, closing_credit
          FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = 1
        )
        SELECT 
          COALESCE(o.account_code, m.account_code) AS account_code,
          COALESCE(o.partner_id, m.partner_id) AS partner_id,
          o.opening_debit, o.opening_credit,
          m.closing_debit, m.closing_credit
        FROM ob_summary o
        FULL OUTER JOIN mb_summary m 
          ON o.account_code = m.account_code AND o.partner_id = m.partner_id
        WHERE (o.opening_debit IS NULL AND m.closing_debit > 0)
           OR (o.opening_credit IS NULL AND m.closing_credit > 0)
      `, [companyId, year]);

      for (const row of janCheck.rows) {
        errors.push(`Tháng 1: TK ${row.account_code} (partner=${row.partner_id}) có số dư ${row.closing_debit}/${row.closing_credit} nhưng không có số dư đầu kỳ`);
      }
    }

    // 3. Kiểm tra tính liên tục giữa các tháng
    for (let m = 2; m <= 12; m++) {
      if (existingMonths.includes(m) && existingMonths.includes(m - 1)) {
        const continuityCheck = await client.query(`
          WITH prev_month AS (
            SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
                   closing_debit, closing_credit
            FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = $3
          ),
          curr_month AS (
            SELECT account_code, COALESCE(partner_id, 0) AS partner_id,
                   closing_debit, closing_credit
            FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = $4
          )
          SELECT 
            p.account_code, p.partner_id,
            p.closing_debit AS prev_debit, p.closing_credit AS prev_credit,
            c.closing_debit AS curr_debit, c.closing_credit AS curr_credit
          FROM prev_month p
          FULL OUTER JOIN curr_month c
            ON p.account_code = c.account_code AND p.partner_id = c.partner_id
          WHERE p.closing_debit IS NOT NULL 
            AND c.closing_debit IS NULL
            AND p.closing_debit + p.closing_credit > 0
        `, [companyId, year, m - 1, m]);

        for (const row of continuityCheck.rows) {
          warnings.push(`TK ${row.account_code} (partner=${row.partner_id}): Có số dư tháng ${m - 1} (${row.prev_debit}/${row.prev_credit}) nhưng không tồn tại trong tháng ${m}`);
        }
      }
    }

    // 4. Kiểm tra tổng Nợ = tổng Có (bảng cân đối kế toán)
    for (const m of existingMonths) {
      const balanceCheck = await client.query(`
        SELECT 
          SUM(closing_debit) AS total_debit,
          SUM(closing_credit) AS total_credit
        FROM monthly_balances
        WHERE company_id = $1 AND year = $2 AND month = $3 AND partner_id = 0
      `, [companyId, year, m]);

      const totalDebit = parseFloat(balanceCheck.rows[0]?.total_debit) || 0;
      const totalCredit = parseFloat(balanceCheck.rows[0]?.total_credit) || 0;
      const diff = Math.abs(totalDebit - totalCredit);

      if (diff > 0.01) {
        warnings.push(`Tháng ${m}/${year}: Tổng Nợ (${totalDebit}) ≠ Tổng Có (${totalCredit}), chênh lệch ${diff}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        company_id: companyId,
        year,
        months_present: existingMonths,
        months_count: existingMonths.length,
        total_errors: errors.length,
        total_warnings: warnings.length
      }
    };
  } catch (error) {
    console.error('[validateMonthlyBalances] Lỗi:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default { rebuildLedger, updateMonthlyBalanceForMonth, validateMonthlyBalances };