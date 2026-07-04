// FILE_PATH: backend/utils/accountingEngine.js
import { pool } from '../config/db.js';
import { getGeneralAccountingRules, getClosingRules } from '../config/businessRules.js';

const getHermaphroditicAccounts = () => {
  const rules = getGeneralAccountingRules();
  return Array.isArray(rules.hermaphroditicAccounts) && rules.hermaphroditicAccounts.length > 0
    ? rules.hermaphroditicAccounts.map((account) => String(account || '').trim()).filter(Boolean)
    : ['131', '331', '138', '338', '3334', '3335', '3381'];
};

const isHermaphroditicAccount = (accountCode) => {
  const normalized = String(accountCode || '').trim();
  if (!normalized) return false;
  return getHermaphroditicAccounts().some((account) => normalized.startsWith(account));
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
 * Tính toán số dư tài khoản thông thường và tài khoản lưỡng tính theo TT 99/2025/TT-BTC
 * Danh sách tài khoản lưỡng tính quản lý chi tiết theo đối tượng:
 * - 131, 331, 138, 338: Nhóm công nợ khách hàng, nhà cung cấp, phải thu/phải trả khác
 * - 3334, 3335: Thuế TNDN và Thuế TNCN (Dư Nợ khi tạm nộp thừa vào NSNN)
 * - 3381: Tài sản thừa chờ giải quyết
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null) {
  const isHermaphroditic = isHermaphroditicAccount(accountCode);

  let query = `
    SELECT vd.entry_type, SUM(vd.amount) as total_amount
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND v.is_posted = TRUE AND vd.account_code LIKE $2
  `;
  
  const params = [companyId, `${accountCode}%`];

  // Nếu là tài khoản lưỡng tính đặc biệt, bắt buộc phải lọc nghiêm ngặt theo đối tác cụ thể
  if (isHermaphroditic && partnerId) {
    query += ` AND vd.partner_id = $3`;
    params.push(partnerId);
  }

  query += ` GROUP BY vd.entry_type`;

  const { rows } = await pool.query(query, params);
  
  let debitSum = 0;
  let creditSum = 0;

  rows.forEach(row => {
    if (row.entry_type === 'DR') debitSum += parseFloat(row.total_amount) || 0;
    if (row.entry_type === 'CR') creditSum += parseFloat(row.total_amount) || 0;
  });

  const isAsset = accountCode.startsWith('1') || accountCode.startsWith('2') || accountCode.startsWith('6') || accountCode.startsWith('8');
  const isProfitLoss = accountCode.startsWith('421'); // Hỗ trợ tài khoản 421 lãi/lỗ
  
  if (isHermaphroditic) {
    return { 
      debit_balance: debitSum, 
      credit_balance: creditSum,
      is_hermaphroditic: true 
    };
  }

  if (isAsset || isProfitLoss) {
    return { balance: debitSum - creditSum }; // Số dư Nợ (hoặc âm nếu dư Có)
  } else {
    return { balance: creditSum - debitSum }; // Số dư Có (hoặc âm nếu dư Nợ)
  }
}

/**
 * [TỐI ƯU] Tính số dư tài khoản bằng Window Function PostgreSQL
 * Chuyển tính toán từ RAM Node.js xuống Database, giảm OOM
 */
export async function getBalancesWithWindowFunction(companyId, year, month = null) {
  const { pool } = await import('../config/db.js');
  
  let query = `
    WITH period_aggregation AS (
      SELECT 
        vd.account_code,
        vd.partner_id,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) OVER (
          PARTITION BY vd.account_code, vd.partner_id
          ORDER BY v.voucher_date, v.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) OVER (
          PARTITION BY vd.account_code, vd.partner_id
          ORDER BY v.voucher_date, v.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1
        AND v.is_posted = TRUE
        AND EXTRACT(YEAR FROM v.voucher_date) = $2
  `;
  
  const params = [companyId, year];
  let paramIdx = 3;
  
  if (month) {
    query += ` AND EXTRACT(MONTH FROM v.voucher_date) <= $${paramIdx}`;
    params.push(month);
    paramIdx++;
  }
  
  query += `
    )
    SELECT 
      account_code,
      MAX(running_debit) as final_debit,
      MAX(running_credit) as final_credit
    FROM period_aggregation
    GROUP BY account_code
    ORDER BY account_code
  `;
  
  const { rows } = await pool.query(query, params);
  
  // Chuyển đổi kết quả về format ledger
  const ledger = {};
  for (const row of rows) {
    const accCode = row.account_code;
    if (!ledger[accCode]) {
      ledger[accCode] = { patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
    }
    ledger[accCode].patsinhDr = parseFloat(row.final_debit) || 0;
    ledger[accCode].patsinhCr = parseFloat(row.final_credit) || 0;
    ledger[accCode].closingDr = ledger[accCode].patsinhDr;
    ledger[accCode].closingCr = ledger[accCode].patsinhCr;
  }
  
  return ledger;
}

/**
 * Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ (Dùng cho Bảng Cân Đối Tài Khoản)
 * Hỗ trợ tài khoản lưỡng tính theo đối tác (TK 131, 331)
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Nạp số dư đầu kỳ dồn tích, hỗ trợ partner_id cho tài khoản lưỡng tính
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
          patsinhDr: 0, 
          patsinhCr: 0, 
          closingDr: 0, 
          closingCr: 0,
          accountCode: accCode,
          partnerId: partnerId
        };
      }
      ledger[ledgerKey].patsinhDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[ledgerKey].patsinhCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[ledgerKey].closingDr = ledger[ledgerKey].patsinhDr;
      ledger[ledgerKey].closingCr = ledger[ledgerKey].patsinhCr;
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

export function getClosingBalance(ledger, accountCode, accountType = 'asset', partnerId = null) {
  const isHermaphroditic = isHermaphroditicAccount(accountCode);
  
  // Tìm key phù hợp trong ledger
  let ledgerKey = accountCode;
  if (isHermaphroditic && partnerId) {
    ledgerKey = `${accountCode}_${partnerId}`;
  }
  
  if (!ledger[ledgerKey]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[ledgerKey];
  
  if (isHermaphroditic) {
    return {
      type: 'hermaphroditic',
      debit: patsinhDr,
      credit: patsinhCr,
      net: patsinhDr - patsinhCr
    };
  }
  
  const isProfitLoss = accountCode.startsWith('421');
  if (accountType === 'asset' || accountType === 'expense' || isProfitLoss) {
    return patsinhDr - patsinhCr;
  } else {
    return patsinhCr - patsinhDr;
  }
}

// BỔ SUNG: Lấy tổng phát sinh Nợ phục vụ báo cáo KQKD Thông tư 99
export function getTotalDebit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhDr || 0;
}

// BỔ SUNG: Lấy tổng phát sinh Có phục vụ báo cáo KQKD Thông tư 99
export function getTotalCredit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhCr || 0;
}

/**
 * Tính thuế suất TNDN theo mức lũy tiến dựa trên doanh thu năm trước
 * - 15%: Doanh thu ≤ 3 tỷ VNĐ
 * - 17%: Doanh thu từ trên 3 tỷ đến 50 tỷ VNĐ
 * - 20%: Doanh thu trên 50 tỷ VNĐ
 * @param {number} revenue - Doanh thu năm trước (VNĐ)
 * @returns {number} - Thuế suất áp dụng
 */
export function getTaxRateByRevenue(revenue) {
  const closingRules = getClosingRules();
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