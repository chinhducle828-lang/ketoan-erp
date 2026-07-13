/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: backend/utils/accountingEngine.js
import { pool } from '../config/db.js';
import { getGeneralAccountingRules, getClosingRules, getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';
import { calculateNetBalance } from './accountNature.js';

const isHermaphroditicAccount = (accountCode) => {
  const normalized = String(accountCode || '').trim();
  if (!normalized) return false;
  return getAccountNature(normalized) === ACCOUNT_NATURES.BOTH;
};

/**
 * Kiểm tra xem ngày chứng từ có nằm trong vùng đã bị khóa sổ kế toán hay không
 */
export async function checkLockDate(companyId, voucherDate) {
  const query = 'SELECT lock_date FROM companies WHERE id = $1';
  const { rows } = await pool.query(query, [companyId]);
  if (rows.length === 0 || !rows[0].lock_date) return false;

  const lockDate = new Date(rows[0].lock_date);
  const targetDate = new Date(voucherDate);
  return targetDate <= lockDate;
}

/**
 * @function getAccountBalance
 * @description [CƠ CHẾ SỐ DƯ] Tính toán số dư tức thời (Real-time Net Balance) của một tài khoản.
 * Bắt buộc phải gộp Số dư đầu kỳ (Opening Balance) và các Phát sinh (Transactions) trong năm tài chính.
 * 
 * @IMPORTANT Dùng cho các logic chặn chi vượt hạn mức, kiểm tra điều kiện xuất quỹ/kho.
 * KHÔNG dùng làm sổ chi tiết giao dịch.
 * 
 * @param {number} companyId - ID của công ty/doanh nghiệp.
 * @param {string} accountCode - Mã tài khoản kế toán (ví dụ: '1111', '112%').
 * @param {number} partnerId - ID đối tác (bắt buộc cho tài khoản lưỡng tính: 131, 331, 138, 338, 3334, 3335, 3381).
 * @returns {Promise<Object>} Đối tượng chứa số dư:
 *   - {balance: number} cho tài khoản thông thường (số dư Nợ dương/Có âm)
 *   - {debit_balance: number, credit_balance: number, is_hermaphroditic: true} cho tài khoản lưỡng tính
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null) {
  const isHermaphroditic = isHermaphroditicAccount(accountCode);

  // Query bao gồm opening balances + transactions
  let query = `
    WITH opening AS (
      SELECT 'DR' as entry_type, opening_debit as amount
      FROM opening_balances
      WHERE company_id = $1 AND account_code LIKE $2
    `;
  
  const params = [companyId, `${accountCode}%`];
  let paramIdx = 3;

  if (isHermaphroditic && partnerId) {
    query += ` AND partner_id = $${paramIdx}`;
    params.push(partnerId);
    paramIdx++;
  }
  
  query += ` UNION ALL SELECT 'CR' as entry_type, opening_credit FROM opening_balances WHERE company_id = $1 AND account_code LIKE $2`;
  if (isHermaphroditic && partnerId) {
    query += ` AND partner_id = $${paramIdx - 1}`;
  }
  
  query += `),
  transactions AS (
    SELECT vd.entry_type, SUM(vd.amount) as total_amount
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND v.is_posted = TRUE AND vd.account_code LIKE $2
  `;
  
  if (isHermaphroditic && partnerId) {
    query += ` AND vd.partner_id = $${paramIdx}`;
    params.push(partnerId);
  }

  query += ` GROUP BY vd.entry_type
  )
  SELECT entry_type, SUM(amount) as total_amount
  FROM (
    SELECT * FROM opening
    UNION ALL
    SELECT * FROM transactions
  ) combined
  GROUP BY entry_type`;

  const { rows } = await pool.query(query, params);
  
  let debitSum = 0;
  let creditSum = 0;

  rows.forEach(row => {
    if (row.entry_type === 'DR') debitSum += parseFloat(row.total_amount) || 0;
    if (row.entry_type === 'CR') creditSum += parseFloat(row.total_amount) || 0;
  });

  const accountNature = getAccountNature(accountCode);
  
  if (accountNature === ACCOUNT_NATURES.BOTH) {
    return { 
      debit_balance: debitSum, 
      credit_balance: creditSum,
      is_hermaphroditic: true,
      account_nature: accountNature
    };
  }

  // Use dynamic account nature to calculate balance
  const { netBalance, balanceType } = calculateNetBalance(debitSum, creditSum, accountNature);
  
  return { 
    balance: balanceType === ACCOUNT_NATURES.DEBIT ? netBalance : -netBalance,
    account_nature: accountNature,
    balance_type: balanceType
  };
}

/**
 * @function getAggregatedBalances
 * @description [CƠ CHẾ SỐ DƯ] Tính toán bảng số dư tài khoản bằng kỹ thuật gộp nhóm (GROUP BY + FULL OUTER JOIN)
 * từ bảng `opening_balances` và `voucher_details`. Trả về số dư đầu kỳ, phát sinh trong kỳ, và số dư cuối kỳ
 * dưới dạng 4 trường tường minh: openingDr, openingCr, patsinhDr, patsinhCr, closingDr, closingCr.
 * 
 * @NOTE Đây là kỹ thuật Aggregation (gộp nhóm) thông thường, KHÔNG phải Window Function.
 * Sử dụng CTE + SUM() với GROUP BY + FULL OUTER JOIN để hợp nhất số dư đầu kỳ và phát sinh.
 * 
 * @param {number} companyId - ID của công ty.
 * @param {number} fiscalYear - Năm tài chính cần quét báo cáo.
 * @param {number} month - Tháng cuối kỳ cần báo cáo (null = cả năm).
 * @returns {Promise<Object>} Bảng số dư theo tài khoản: 
 *   { [account_code]: { openingDr, openingCr, patsinhDr, patsinhCr, closingDr, closingCr } }
 */
export async function getAggregatedBalances(companyId, year, month = null) {
  // Validate inputs
  if (!companyId || !year) {
    throw new Error('companyId and year are required parameters');
  }
  
  const params = [companyId, year];
  let paramIdx = 3;
  
  // Month filter for vouchers
  let voucherMonthFilter = '';
  if (month) {
    voucherMonthFilter = ` AND EXTRACT(MONTH FROM v.voucher_date) <= $${paramIdx}`;
    params.push(month);
    paramIdx++;
  }
  
  let query = `
    WITH base_balances AS (
      -- Số dư đầu kỳ từ opening_balances (chỉ lấy, không gộp với phát sinh)
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
      -- Phát sinh trong kỳ từ vouchers (tách riêng DR/CR)
      SELECT 
        vd.account_code,
        COALESCE(vd.partner_id, 0) as partner_id,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as period_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as period_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1
        AND v.is_posted = TRUE
        AND EXTRACT(YEAR FROM v.voucher_date) = $2
        ${voucherMonthFilter}
      GROUP BY vd.account_code, vd.partner_id
    ),
    combined AS (
      -- FULL OUTER JOIN: hợp nhất số dư đầu kỳ + phát sinh, giữ cả 4 giá trị riêng biệt
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
  
  let rows;
  try {
    const result = await pool.query(query, params);
    rows = result.rows;
  } catch (err) {
    console.error('Error in getAggregatedBalances:', err.message);
    throw err;
  }
  
  // Chuyển đổi kết quả về format ledger với 6 trường tường minh
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
 * @function getBalancesWithWindowFunction
 * @description [DEPRECATED] Thay thế bằng getAggregatedBalances().
 * Giữ lại vì lý do tương thích ngược.
 * @deprecated Dùng getAggregatedBalances() thay thế.
 */
export async function getBalancesWithWindowFunction(companyId, year, month = null) {
  console.warn('DEPRECATED: getBalancesWithWindowFunction() is deprecated. Use getAggregatedBalances() instead.');
  return getAggregatedBalances(companyId, year, month);
}

/**
 * @function calculateBalances
 * @description [CƠ CHẾ SỐ DƯ] Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ (Dùng cho Bảng Cân Đối Tài Khoản).
 * Hỗ trợ tài khoản lưỡng tính theo đối tác (TK 131, 331, 138, 338, 3334, 3335, 3381).
 * 
 * @NOTE Số dư đầu kỳ (openingDr/openingCr) được tách riêng khỏi phát sinh trong kỳ (patsinhDr/patsinhCr).
 * getTotalDebit() và getTotalCredit() chỉ đọc patsinhDr/patsinhCr nên KHÔNG bị nhiễm số dư đầu kỳ.
 * 
 * @param {Array} vouchers - Danh sách chứng từ có details: [{ details: [{ accountCode, entryType, amount, partnerId }] }]
 * @param {Array} openingBalances - Số dư đầu kỳ: [{ account_code, opening_debit, opening_credit, partner_id }]
 * @returns {Object} Bảng số dư: { [account_code]: { openingDr, openingCr, patsinhDr, patsinhCr, closingDr, closingCr, accountCode, partnerId } }
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Nạp số dư đầu kỳ (riêng biệt, KHÔNG cộng vào patsinhDr/patsinhCr)
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.account_code || ob.accountCode;
      const partnerId = ob.partner_id || ob.partnerId || null;
      
      // Kiểm tra tài khoản lưỡng tính
      const isHermaphroditic = isHermaphroditicAccount(accCode);
      
      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
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
      // Chỉ cộng vào openingDr/openingCr - KHÔNG cộng vào patsinhDr/patsinhCr
      ledger[ledgerKey].openingDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[ledgerKey].openingCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      // closingDr = openingDr + patsinhDr (patsinhDr chưa có gì ở bước này)
      ledger[ledgerKey].closingDr = ledger[ledgerKey].openingDr;
      ledger[ledgerKey].closingCr = ledger[ledgerKey].openingCr;
    });
  }

  // Lũy kế phát sinh trong kỳ từ chứng từ (Chấp nhận amount âm cho hạch toán điều chỉnh đỏ)
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;
      const partnerId = detail.partnerId || detail.partner_id || null;

      // Kiểm tra tài khoản lưỡng tính
      const isHermaphroditic = isHermaphroditicAccount(accCode);

      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
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

  return ledger;
}

/**
 * @function getClosingBalance
 * @description [CƠ CHẾ SỐ DƯ] Lấy số dư cuối kỳ (Net Closing Balance) từ bảng số dư đã tính toán.
 * 
 * @param {Object} ledger - Bảng số dư từ calculateBalances() hoặc getBalancesWithWindowFunction()
 * @param {string} accountCode - Mã tài khoản cần lấy số dư
 * @param {string} accountType - Loại tài khoản: 'asset' | 'liability' | 'expense' | 'revenue' | 'equity'
 * @param {number} partnerId - ID đối tác (bắt buộc cho tài khoản lưỡng tính)
 * @returns {number|Object} Số dư cuối kỳ (số dương = Nợ cho tài sản, Có cho nợ phải trả)
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset', partnerId = null) {
  const isHermaphroditic = isHermaphroditicAccount(accountCode);
  const accountNature = getAccountNature(accountCode);

  const matchingEntries = Object.entries(ledger || {}).filter(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    const entryAccountCode = value.accountCode || value.account_code || key.split('_')[0];
    if (String(entryAccountCode) !== String(accountCode)) return false;
    if (!isHermaphroditic) return true;
    if (partnerId == null) return true;
    const entryPartnerId = value.partnerId ?? value.partner_id ?? null;
    return Number(entryPartnerId) === Number(partnerId);
  });

  if (matchingEntries.length === 0) {
    return accountNature === ACCOUNT_NATURES.BOTH
      ? { type: 'hermaphroditic', debit: 0, credit: 0, net: 0, account_nature: accountNature }
      : { net: 0, account_nature: accountNature, balance_type: accountNature, debit: 0, credit: 0 };
  }

  const aggregate = matchingEntries.reduce(
    (sum, [, entry]) => ({
      closingDr: sum.closingDr + Number(entry.closingDr || 0),
      closingCr: sum.closingCr + Number(entry.closingCr || 0),
      patsinhDr: sum.patsinhDr + Number(entry.patsinhDr || 0),
      patsinhCr: sum.patsinhCr + Number(entry.patsinhCr || 0),
      openingDr: sum.openingDr + Number(entry.openingDr || 0),
      openingCr: sum.openingCr + Number(entry.openingCr || 0)
    }),
    { closingDr: 0, closingCr: 0, patsinhDr: 0, patsinhCr: 0, openingDr: 0, openingCr: 0 }
  );

  const { closingDr, closingCr, patsinhDr, patsinhCr, openingDr, openingCr } = aggregate;

  if (accountNature === ACCOUNT_NATURES.BOTH) {
    return {
      type: 'hermaphroditic',
      opening: { debit: openingDr, credit: openingCr },
      period: { debit: patsinhDr, credit: patsinhCr },
      debit: closingDr,
      credit: closingCr,
      net: closingDr - closingCr,
      account_nature: accountNature
    };
  }

  const { netBalance, balanceType } = calculateNetBalance(closingDr, closingCr, accountNature);

  return {
    net: balanceType === ACCOUNT_NATURES.DEBIT ? netBalance : -netBalance,
    account_nature: accountNature,
    balance_type: balanceType,
    opening: { debit: openingDr, credit: openingCr },
    period: { debit: patsinhDr, credit: patsinhCr },
    debit: closingDr,
    credit: closingCr
  };
}

/**
 * @function getTotalDebit
 * @description [CƠ CHẾ PHÁT SINH] Lấy tổng phát sinh Nợ (Total Debit Movement) trong kỳ.
 * Dùng cho báo cáo KQKD theo Thông tư 99/2025/TT-BTC.
 * 
 * @WARNING Chỉ trả về phát sinh trong kỳ, KHÔNG bao gồm số dư đầu kỳ.
 * 
 * @param {Object} ledger - Bảng số dư từ calculateBalances()
 * @param {string} accountCode - Mã tài khoản
 * @returns {number} Tổng phát sinh Nợ
 */
export function getTotalDebit(ledger, accountCode) {
  const entries = Object.entries(ledger || {}).filter(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    const entryAccountCode = value.accountCode || value.account_code || key.split('_')[0];
    return String(entryAccountCode) === String(accountCode);
  });

  if (entries.length === 0) return 0;
  return entries.reduce((sum, [, value]) => sum + Number(value.patsinhDr || 0), 0);
}

/**
 * @function getTotalCredit
 * @description [CƠ CHẾ PHÁT SINH] Lấy tổng phát sinh Có (Total Credit Movement) trong kỳ.
 * Dùng cho báo cáo KQKD theo Thông tư 99/2025/TT-BTC.
 * 
 * @WARNING Chỉ trả về phát sinh trong kỳ, KHÔNG bao gồm số dư đầu kỳ.
 * 
 * @param {Object} ledger - Bảng số dư từ calculateBalances()
 * @param {string} accountCode - Mã tài khoản
 * @returns {number} Tổng phát sinh Có
 */
export function getTotalCredit(ledger, accountCode) {
  const entries = Object.entries(ledger || {}).filter(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    const entryAccountCode = value.accountCode || value.account_code || key.split('_')[0];
    return String(entryAccountCode) === String(accountCode);
  });

  if (entries.length === 0) return 0;
  return entries.reduce((sum, [, value]) => sum + Number(value.patsinhCr || 0), 0);
}

/**
 * Tính thuế suất TNDN theo mức lũy tiến dựa trên doanh thu năm trước
 * - 15%: Doanh thu ≤ 3 tỷ VNĐ
 * - 17%: Doanh thu từ trên 3 tỷ đến 50 tỷ VNĐ
 * - 20%: Doanh thu trên 50 tỷ VNĐ
 * @param {number} revenue - Doanh thu năm trước (VNĐ)
 * @returns {number} - Thuế suất áp dụng
 */
export function getTaxRateByRevenue(revenue, entityType = 'company') {
  const closingRules = getClosingRules();
  const normalizedEntityType = String(entityType || 'company').trim().toLowerCase();

  // Hộ kinh doanh (thuế khoán) và Hợp tác xã (ưu đãi) áp dụng mức thuế riêng
  if (normalizedEntityType === 'household') {
    return 0; // Thuế khoán, không tính thuế TNDN lũy tiến
  }
  if (normalizedEntityType === 'cooperative') {
    return 0.1; // Ưu đãi thuế TNDN cho hợp tác xã
  }

  // Support both progressiveTaxBrackets (new) and taxBracketsByRevenue (legacy)
  const brackets = Array.isArray(closingRules.progressiveTaxBrackets)
    ? [...closingRules.progressiveTaxBrackets]
    : Array.isArray(closingRules.taxBracketsByRevenue)
      ? [...closingRules.taxBracketsByRevenue]
      : [];

  if (brackets.length === 0) {
    if (revenue <= 3000000000) return 0.15;
    if (revenue <= 50000000000) return 0.17;
    return 0.20;
  }

  const sortedBrackets = brackets
    .map((bracket) => ({
      maxRevenue: bracket?.maxRevenue == null ? Number.POSITIVE_INFINITY : Number(bracket?.maxRevenue),
      rate: Number(bracket?.rate)
    }))
    .filter((bracket) => Number.isFinite(bracket.rate))
    .sort((a, b) => {
      const aMax = Number.isFinite(a.maxRevenue) ? a.maxRevenue : Number.POSITIVE_INFINITY;
      const bMax = Number.isFinite(b.maxRevenue) ? b.maxRevenue : Number.POSITIVE_INFINITY;
      return aMax - bMax;
    });

  for (const bracket of sortedBrackets) {
    if (!Number.isFinite(bracket.maxRevenue) || revenue <= bracket.maxRevenue) {
      return bracket.rate;
    }
  }

  return sortedBrackets[sortedBrackets.length - 1]?.rate ?? 0.2;
}

/**
 * Tính thuế TNDN tự động dựa trên lợi nhuận trước thuế
 * @param {number} profitBeforeTax - Lợi nhuận trước thuế
 * @param {number} prevYearRevenue - Doanh thu năm trước (để tính thuế suất lũy tiến)
 * @returns {Object} - { taxAmount, taxRate }
 */
export function calculateTax(profitBeforeTax, prevYearRevenue = 0) {
  if (profitBeforeTax <= 0) {
    return {
      taxAmount: 0,
      taxRate: 0
    };
  }
  
  const taxRate = getTaxRateByRevenue(prevYearRevenue);
  const taxAmount = profitBeforeTax * taxRate;
  
  return {
    taxAmount,
    taxRate
  };
}

/**
 * Tính thuế TNDN lũy tiến thực sự (Progressive Tax Calculation)
 * Áp dụng thuế suất khác nhau cho từng phần doanh thu:
 * - 15% cho phần doanh thu ≤ 3 tỷ
 * - 17% cho phần doanh thu từ 3-50 tỷ
 * - 20% cho phần doanh thu trên 50 tỷ
 * @param {number} revenue - Doanh thu năm trước (VNĐ)
 * @param {number} profit - Lợi nhuận trước thuế (VNĐ)
 * @returns {Object} - { totalTax, appliedRate, breakdown: [{ threshold, amount, rate, tax }] }
 */
export function calculateProgressiveTax(revenue, profit, entityType = 'company') {
  const closingRules = getClosingRules();
  const normalizedEntityType = String(entityType || 'company').trim().toLowerCase();

  // Hộ kinh doanh (thuế khoán) và Hợp tác xã (ưu đãi) áp dụng mức thuế riêng
  if (normalizedEntityType === 'household') {
    return { totalTax: 0, appliedRate: 0, breakdown: [] };
  }
  if (normalizedEntityType === 'cooperative') {
    const tax = profit > 0 ? profit * 0.1 : 0;
    return {
      totalTax: tax,
      appliedRate: profit > 0 ? 0.1 : 0,
      breakdown: profit > 0 ? [{ threshold: null, amount: profit, rate: 0.1, tax }] : []
    };
  }

  const brackets = Array.isArray(closingRules.progressiveTaxBrackets)
    ? closingRules.progressiveTaxBrackets
    : [
        { maxRevenue: 3000000000, rate: 0.15 },
        { maxRevenue: 50000000000, rate: 0.17 },
        { maxRevenue: null, rate: 0.20 }
      ];

  if (profit <= 0) {
    return { totalTax: 0, appliedRate: 0, breakdown: [] };
  }

  // Tính thuế lũy tiến dựa trên tỷ lệ lợi nhuận/doanh thu
  // Giả sử lợi nhuận phân bố tương ứng với doanh thu
  // FIX: Tránh division by zero khi revenue = 0
  const effectiveRate = revenue > 0 ? profit / revenue : 0; // Tỷ lệ lợi nhuận trên doanh thu
  
  let remainingProfit = profit;
  let totalTax = 0;
  const breakdown = [];

  for (const bracket of brackets) {
    const maxRevenue = bracket?.maxRevenue;
    const rate = Number(bracket?.rate);
    
    if (!Number.isFinite(rate)) continue;

    // Xác định phần doanh thu tại mức thuế này
    const profitAtThisBracket = maxRevenue === null || maxRevenue === undefined
      ? remainingProfit
      : Math.min(remainingProfit, maxRevenue * effectiveRate);

    if (profitAtThisBracket > 0) {
      const taxAtThisBracket = profitAtThisBracket * rate;
      totalTax += taxAtThisBracket;
      
      breakdown.push({
        threshold: maxRevenue,
        amount: profitAtThisBracket,
        rate: rate,
        tax: taxAtThisBracket
      });
      
      remainingProfit -= profitAtThisBracket;
    }

    if (remainingProfit <= 0) break;
  }

  // Tính thuế suất áp dụng trung bình
  const appliedRate = profit > 0 ? totalTax / profit : 0;

  return {
    totalTax,
    appliedRate,
    breakdown
  };
}

/**
 * Tính toán lợi nhuận trước thuế từ dữ liệu kế toán
 * @param {number} revenue - Doanh thu
 * @param {number} otherIncome - Thu nhập khác
 * @param {number} costOfGoodsSold - Giá vốn hàng bán
 * @param {number} operatingExpenses - Chi phí hoạt động
 * @param {number} otherExpenses - Chi phí khác
 * @param {number} taxExpense - Thuế đầu vào đã trừ
 * @returns {number} - Lợi nhuận trước thuế
 */
export function calculateProfitBeforeTax(revenue, otherIncome, costOfGoodsSold, operatingExpenses, otherExpenses, taxExpense = 0) {
  return revenue + otherIncome - costOfGoodsSold - operatingExpenses - otherExpenses - taxExpense;
}