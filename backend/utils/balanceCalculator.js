/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * balanceCalculator.js - Consolidated balance calculation functions
 * Single source of truth cho tất cả balance calculations
 * 
 * @IMPORTANT: Thay thế getAccountBalance() trong accountingEngine.js bằng các functions này
 */

import { pool } from '../config/db.js';
import { getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';
import { calculateNetBalance } from './accountNature.js';

/**
 * Check if account is hermaphroditic (dual nature: 131, 331, 138, 338, 3334, 3335, 3381)
 */
const isHermaphroditicAccount = (accountCode) => {
  const normalized = String(accountCode || '').trim();
  if (!normalized) return false;
  return getAccountNature(normalized) === ACCOUNT_NATURES.BOTH;
};

/**
 * @function getAccountBalance
 * @description [CONSOLIDATED] Tính toán số dư tức thời của một tài khoản
 * Thay thế cho getAccountBalance() trong accountingEngine.js
 * 
 * @param {number} companyId - ID công ty
 * @param {string} accountCode - Mã tài khoản (ví dụ: '1111', '112%', '131')
 * @param {number|null} partnerId - ID đối tác (bắt buộc cho tài khoản lưỡng tính)
 * @param {boolean} includeUnposted - Có bao gồm chứng từ chưa ghi sổ không (default: false)
 * @returns {Promise<Object>} Số dư tài khoản
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null, includeUnposted = false) {
  const isHermaphroditic = isHermaphroditicAccount(accountCode);
  const accountNature = getAccountNature(accountCode);

  // Build query với CTEs
  let query = `
    WITH opening AS (
      SELECT 
        'DR' as entry_type, 
        SUM(opening_debit) as amount
      FROM opening_balances
      WHERE company_id = $1 AND account_code LIKE $2
  `;

  const params = [companyId, `${accountCode}%`];
  let paramIdx = 3;

  // Filter by partner_id for hermaphroditic accounts
  if (isHermaphroditic && partnerId) {
    query += ` AND partner_id = $${paramIdx}`;
    params.push(partnerId);
    paramIdx++;
  }

  query += ` GROUP BY entry_type
      UNION ALL
      SELECT 
        'CR' as entry_type, 
        SUM(opening_credit) as amount
      FROM opening_balances
      WHERE company_id = $1 AND account_code LIKE $2`;

  if (isHermaphroditic && partnerId) {
    query += ` AND partner_id = $${paramIdx}`;
  }

  query += ` GROUP BY entry_type
    ),
    transactions AS (
      SELECT 
        vd.entry_type, 
        SUM(vd.amount) as total_amount
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
  `;

  if (!includeUnposted) {
    query += ` AND v.is_posted = TRUE`;
  }

  if (isHermaphroditic && partnerId) {
    query += ` AND vd.partner_id = $${paramIdx}`;
    params.push(partnerId);
  }

  query += `
      GROUP BY vd.entry_type
    )
    SELECT 
      entry_type, 
      SUM(amount) as total_amount
    FROM (
      SELECT * FROM opening
      UNION ALL
      SELECT * FROM transactions
    ) combined
    GROUP BY entry_type
  `;

  const { rows } = await pool.query(query, params);

  let debitSum = 0;
  let creditSum = 0;

  rows.forEach(row => {
    if (row.entry_type === 'DR') debitSum += parseFloat(row.total_amount) || 0;
    if (row.entry_type === 'CR') creditSum += parseFloat(row.total_amount) || 0;
  });

  // Return format based on account nature
  if (accountNature === ACCOUNT_NATURES.BOTH) {
    return {
      debit_balance: debitSum,
      credit_balance: creditSum,
      is_hermaphroditic: true,
      account_nature: accountNature
    };
  }

  const { netBalance, balanceType } = calculateNetBalance(debitSum, creditSum, accountNature);

  return {
    balance: balanceType === ACCOUNT_NATURES.DEBIT ? netBalance : -netBalance,
    account_nature: accountNature,
    balance_type: balanceType
  };
}

/**
 * @function getAccountBalanceByPartner
 * @description Lấy số dư tài khoản lưỡng tính theo từng đối tác
 * 
 * @param {number} companyId - ID công ty
 * @param {string} accountCode - Mã tài khoản (131, 331, etc.)
 * @param {boolean} includeUnposted - Có bao gồm chứng từ chưa ghi sổ không
 * @returns {Promise<Array>} Mảng số dư theo từng đối tác
 */
export async function getAccountBalanceByPartner(companyId, accountCode, includeUnposted = false) {
  if (!isHermaphroditicAccount(accountCode)) {
    throw new Error(`Account ${accountCode} is not a hermaphroditic account`);
  }

  const query = `
    WITH opening AS (
      SELECT 
        COALESCE(partner_id, 0) as partner_id,
        SUM(opening_debit) as opening_debit,
        SUM(opening_credit) as opening_credit
      FROM opening_balances
      WHERE company_id = $1 AND account_code LIKE $2
      GROUP BY partner_id
    ),
    transactions AS (
      SELECT 
        COALESCE(vd.partner_id, 0) as partner_id,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
        ${includeUnposted ? '' : 'AND v.is_posted = TRUE'}
      GROUP BY vd.partner_id
    ),
    combined AS (
      SELECT 
        COALESCE(o.partner_id, p.partner_id) as partner_id,
        COALESCE(o.opening_debit, 0) + COALESCE(p.debit_total, 0) as total_debit,
        COALESCE(o.opening_credit, 0) + COALESCE(p.credit_total, 0) as total_credit
      FROM opening o
      FULL OUTER JOIN transactions p ON o.partner_id = p.partner_id
    )
    SELECT 
      c.partner_id,
      p.partner_name,
      p.partner_code,
      c.total_debit,
      c.total_credit,
      (c.total_debit - c.total_credit) as net_balance
    FROM combined c
    LEFT JOIN partners p ON c.partner_id = p.id
    WHERE c.partner_id > 0
    ORDER BY p.partner_name
  `;

  const { rows } = await pool.query(query, [companyId, `${accountCode}%`]);

  return rows.map(row => ({
    partner_id: row.partner_id,
    partner_name: row.partner_name,
    partner_code: row.partner_code,
    debit_balance: parseFloat(row.total_debit) || 0,
    credit_balance: parseFloat(row.total_credit) || 0,
    net_balance: parseFloat(row.net_balance) || 0
  }));
}

/**
 * @function getAggregatedBalances
 * @description [CONSOLIDATED] Tính toán bảng số dư tài khoản tổng hợp
 * 
 * @param {number} companyId - ID công ty
 * @param {number} fiscalYear - Năm tài chính
 * @param {number|null} month - Tháng cuối kỳ (null = cả năm)
 * @param {boolean} includeUnposted - Có bao gồm chứng từ chưa ghi sổ không
 * @returns {Promise<Object>} Bảng số dư: { [account_code]: { openingDr, openingCr, patsinhDr, patsinhCr, closingDr, closingCr } }
 */
export async function getAggregatedBalances(companyId, fiscalYear, month = null, includeUnposted = false) {
  if (!companyId || !fiscalYear) {
    throw new Error('companyId and fiscalYear are required parameters');
  }

  const params = [companyId, fiscalYear];
  let paramIdx = 3;

  // Month filter for vouchers
  let voucherMonthFilter = '';
  if (month) {
    voucherMonthFilter = ` AND EXTRACT(MONTH FROM v.voucher_date) <= $${paramIdx}`;
    params.push(month);
    paramIdx++;
  }

  const postedFilter = includeUnposted ? '' : 'AND v.is_posted = TRUE';

  const query = `
    WITH base_balances AS (
      -- Số dư đầu kỳ từ opening_balances
      SELECT 
        account_code,
        COALESCE(partner_id, 0) as partner_id,
        SUM(opening_debit) as base_debit,
        SUM(opening_credit) as base_credit
      FROM opening_balances
      WHERE company_id = $1 AND fiscal_year = $2
      GROUP BY account_code, partner_id
    ),
    period_aggregation AS (
      -- Phát sinh trong kỳ từ vouchers
      SELECT 
        vd.account_code,
        COALESCE(vd.partner_id, 0) as partner_id,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as period_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as period_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1
        AND EXTRACT(YEAR FROM v.voucher_date) = $2
        ${postedFilter}
        ${voucherMonthFilter}
      GROUP BY vd.account_code, vd.partner_id
    ),
    combined AS (
      -- FULL OUTER JOIN: hợp nhất số dư đầu kỳ + phát sinh
      SELECT 
        COALESCE(b.account_code, p.account_code) as account_code,
        COALESCE(b.partner_id, 0) as partner_id,
        COALESCE(b.base_debit, 0) as base_debit,
        COALESCE(b.base_credit, 0) as base_credit,
        COALESCE(p.period_debit, 0) as period_debit,
        COALESCE(p.period_credit, 0) as period_credit,
        COALESCE(b.base_debit, 0) + COALESCE(p.period_debit, 0) as final_debit,
        COALESCE(b.base_credit, 0) + COALESCE(p.period_credit, 0) as final_credit
      FROM base_balances b
      FULL OUTER JOIN period_aggregation p
        ON b.account_code = p.account_code AND b.partner_id = p.partner_id
    )
    SELECT 
      account_code,
      base_debit,
      base_credit,
      period_debit,
      period_credit,
      final_debit,
      final_credit
    FROM combined
    ORDER BY account_code
  `;

  const { rows } = await pool.query(query, params);

  // Convert to ledger format
  const ledger = {};
  for (const row of rows) {
    const accCode = row.account_code;
    if (!ledger[accCode]) {
      ledger[accCode] = {
        openingDr: 0,
        openingCr: 0,
        patsinhDr: 0,
        patsinhCr: 0,
        closingDr: 0,
        closingCr: 0
      };
    }
    ledger[accCode].openingDr = parseFloat(row.base_debit) || 0;
    ledger[accCode].openingCr = parseFloat(row.base_credit) || 0;
    ledger[accCode].patsinhDr = parseFloat(row.period_debit) || 0;
    ledger[accCode].patsinhCr = parseFloat(row.period_credit) || 0;
    ledger[accCode].closingDr = parseFloat(row.final_debit) || 0;
    ledger[accCode].closingCr = parseFloat(row.final_credit) || 0;
  }

  return ledger;
}

/**
 * @function calculateBalances
 * @description [CONSOLIDATED] Tính toán số dư từ danh sách chứng từ (in-memory)
 * Dùng cho Bảng Cân Đối Tài Khoản
 * 
 * @param {Array} vouchers - Danh sách chứng từ
 * @param {Array} openingBalances - Số dư đầu kỳ
 * @returns {Object} Bảng số dư
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Load opening balances
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.account_code || ob.accountCode;
      const partnerId = ob.partner_id || ob.partnerId || null;
      const isHermaphroditic = isHermaphroditicAccount(accCode);
      const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

      if (!ledger[ledgerKey]) {
        ledger[ledgerKey] = {
          openingDr: 0,
          openingCr: 0,
          patsinhDr: 0,
          patsinhCr: 0,
          closingDr: 0,
          closingCr: 0,
          accountCode: accCode,
          partnerId: partnerId
        };
      }

      ledger[ledgerKey].openingDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[ledgerKey].openingCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[ledgerKey].closingDr = ledger[ledgerKey].openingDr;
      ledger[ledgerKey].closingCr = ledger[ledgerKey].openingCr;
    });
  }

  // Accumulate transactions
  if (Array.isArray(vouchers)) {
    vouchers.forEach(voucher => {
      if (!voucher.details || !Array.isArray(voucher.details)) return;

      voucher.details.forEach(detail => {
        const accCode = detail.accountCode || detail.account_code;
        const entryType = detail.entryType || detail.entry_type;
        const amount = parseFloat(detail.amount) || 0;
        const partnerId = detail.partnerId || detail.partner_id || null;
        const isHermaphroditic = isHermaphroditicAccount(accCode);
        const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

        if (!ledger[ledgerKey]) {
          ledger[ledgerKey] = {
            openingDr: 0,
            openingCr: 0,
            patsinhDr: 0,
            patsinhCr: 0,
            closingDr: 0,
            closingCr: 0,
            accountCode: accCode,
            partnerId: isHermaphroditic ? partnerId : null
          };
        }

        if (entryType === 'DR') {
          ledger[ledgerKey].patsinhDr += amount;
          ledger[ledgerKey].closingDr += amount;
        } else if (entryType === 'CR') {
          ledger[ledgerKey].patsinhCr += amount;
          ledger[ledgerKey].closingCr += amount;
        }
      });
    });
  }

  return ledger;
}

export default {
  getAccountBalance,
  getAccountBalanceByPartner,
  getAggregatedBalances,
  calculateBalances
};