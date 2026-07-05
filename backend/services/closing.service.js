import { pool } from '../config/db.js';
import { invalidateCache } from '../cache/redis.js';
import { getPeriodBalanceSummary } from './summary.service.js';
import { getClosingRules } from '../config/businessRules.js';

const getClosingDate = (year, month) => `${year}-${String(month).padStart(2, '0')}-31`;

const getBalanceByPrefix = async (db, companyId, accountPrefix, month, year) => {
  const query = `
    SELECT
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
      AND vd.account_code LIKE $2
      AND EXTRACT(MONTH FROM v.voucher_date) = $3
      AND EXTRACT(YEAR FROM v.voucher_date) = $4
  `;

  const { rows } = await db.query(query, [companyId, `${accountPrefix}%`, month, year]);
  return {
    debit: parseFloat(rows[0]?.debit_total) || 0,
    credit: parseFloat(rows[0]?.credit_total) || 0
  };
};

/**
  * Tính thuế suất TNDN theo mức lũy tiến dựa trên doanh thu năm trước
  * - 15%: Doanh thu ≤ 3 tỷ VNĐ
  * - 17%: Doanh thu từ trên 3 tỷ đến 50 tỷ VNĐ
  * - 20%: Doanh thu trên 50 tỷ VNĐ
  * @param {number} revenue - Doanh thu năm trước (VNĐ)
  * @returns {number} - Thuế suất áp dụng
  */
export function getTaxRateByRevenue(revenue) {
  const rules = getClosingRules();
  const brackets = Array.isArray(rules.progressiveTaxBrackets)
    ? rules.progressiveTaxBrackets
    : [];

  for (const bracket of brackets) {
    const maxRevenue = bracket?.maxRevenue;
    const rate = Number(bracket?.rate);
    if (!Number.isFinite(rate)) continue;
    if (maxRevenue === null || maxRevenue === undefined || revenue <= Number(maxRevenue)) {
      return rate;
    }
  }

  return Number(rules.defaultTaxRate ?? 0.2);
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
export function calculateProgressiveTax(revenue, profit) {
  const rules = getClosingRules();
  const brackets = Array.isArray(rules.progressiveTaxBrackets)
    ? rules.progressiveTaxBrackets
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
  const effectiveRate = profit / revenue; // Tỷ lệ lợi nhuận trên doanh thu
  
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
  * KẾT CHUYỂN SỔ CUỐI KỲ - ERP KẾ TOÁN
  * LỖI 4: Thuật toán kết chuyển tự động
  */

/**
 * Hàm thực hiện kết chuyển sổ cuối kỳ
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng kết chuyển
 * @param {number} year - Năm kết chuyển
 */
export async function runClosingEntries(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const closingAccounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const revenueAccount = String(closingAccounts.revenue || '511');
  const costAccounts = Array.isArray(closingAccounts.cost) && closingAccounts.cost.length > 0
    ? closingAccounts.cost.map((acc) => String(acc))
    : ['632', '641', '642'];
  const otherIncomeAccount = String(closingAccounts.otherIncome || '711');
  const otherExpenseAccount = String(closingAccounts.otherExpense || '811');
  const taxExpenseAccount = String(closingAccounts.taxExpense || '821');
  const closingAccount = String(closingAccounts.closing || '911');
  const corporateTaxPayableAccount = String(closingAccounts.corporateTaxPayable || '3334');
  const retainedEarningsAccount = String(closingAccounts.retainedEarnings || '4212');
  
  try {
    await client.query('BEGIN');
    
    // [PESSIMISTIC LOCK] Khóa bản ghi công ty để tránh race condition
    // Nếu có 2 request đồng thời, request thứ 2 sẽ nhận lỗi ngay lập tức
    await client.query(
      'SELECT id, lock_date FROM companies WHERE id = $1 FOR UPDATE NOWAIT',
      [companyId]
    );
    
    // Kiểm tra xem đã kết chuyển kỳ này chưa
    const checkClosing = await client.query(
      `SELECT id FROM closing_entries 
       WHERE company_id = $1 AND year = $2 AND month = $3 AND status = 'completed'
       LIMIT 1`,
      [companyId, year, month]
    );
    
    if (checkClosing.rows.length > 0) {
      throw new Error(`Kỳ ${month}/${year} đã được kết chuyển rồi`);
    }
    
    // Ghi log bắt đầu kết chuyển
    await client.query(
      `INSERT INTO closing_entries (company_id, year, month, status, started_at)
       VALUES ($1, $2, $3, 'processing', NOW())`,
      [companyId, year, month]
    );
    
    const closingEntryId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
    
    const summaryRows = await getPeriodBalanceSummary(
      companyId,
      [revenueAccount, ...costAccounts, otherIncomeAccount, otherExpenseAccount, taxExpenseAccount, closingAccount],
      year,
      month
    );
    const summaryMap = Object.fromEntries(summaryRows.map((row) => [row.account_code, row]));

    const accountRevenueCredit = summaryMap[revenueAccount]?.credit || 0;
    
    if (accountRevenueCredit > 0) {
      // Tạo bút toán kết chuyển doanh thu: Nợ TK kết chuyển, Có TK doanh thu
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Kết chuyển doanh thu sang TK kết chuyển')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, closingAccount, accountRevenueCredit, voucherId, revenueAccount, accountRevenueCredit]
      );
    }
    
    // 3. Kết chuyển chi phí: Khấu trừ số dư Nợ các TK chi phí sang TK kết chuyển
    let totalCostDebit = 0;

    for (const acc of costAccounts) {
      totalCostDebit += summaryMap[acc]?.debit || 0;
    }
    
    if (totalCostDebit > 0) {
      // Tạo bút toán kết chuyển chi phí: Nợ TK chi phí, Có TK kết chuyển
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Kết chuyển chi phí sang TK kết chuyển')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      // Phân bổ chi phí cho từng tài khoản
      for (const acc of costAccounts) {
        const costQuery = `
          SELECT SUM(vd.amount) as total_debit
          FROM voucher_details vd
          JOIN vouchers v ON vd.voucher_id = v.id
          WHERE v.company_id = $1 
            AND vd.account_code = $2
            AND vd.entry_type = 'DR'
            AND EXTRACT(MONTH FROM v.voucher_date) = $3
            AND EXTRACT(YEAR FROM v.voucher_date) = $4
        `;
        
        const { rows: costRows } = await client.query(costQuery, [companyId, acc, month, year]);
        const costAmount = parseFloat(costRows[0]?.total_debit) || 0;
        
        if (costAmount > 0) {
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
             VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
            [voucherId, acc, costAmount, voucherId, closingAccount, costAmount]
          );
        }
      }
    }
    
    // 4. Tính thuế TNDN tự động - CẬP NHẬT: Thêm tài khoản 711, 811, 821
    // Công thức: Lãi = Doanh thu (511) + Thu nhập khác (711) - Chi phí (632, 641, 642) - Chi phí khác (811) - Thuế (821)
    const account711Credit = summaryMap[otherIncomeAccount]?.credit || 0;
    const account811Debit = summaryMap[otherExpenseAccount]?.debit || 0;
    const account821Debit = summaryMap[taxExpenseAccount]?.debit || 0;
    
    // Tính lợi nhuận trước thuế: Doanh thu + Thu nhập khác - Chi phí - Chi phí khác - Thuế
    const revenueCredit = accountRevenueCredit;
    const otherIncome = account711Credit;
    const otherExpenses = account811Debit;
    const taxExpense = account821Debit;
    
    const netProfit = revenueCredit + otherIncome - totalCostDebit - otherExpenses - taxExpense;
    
    // Chỉ hạch toán thuế TNDN khi có lợi nhuận (netProfit > 0)
    // Nếu lỗ (netProfit < 0), gán bút toán thuế bằng 0
    let taxAmount = 0;
    let appliedTaxRate = Number(closingRules.defaultTaxRate ?? 0.2);
    let taxBreakdown = [];
    
    if (netProfit > 0) {
      // Tính thuế suất lũy tiến dựa trên doanh thu năm trước
      // Lấy doanh thu năm trước từ TK 511
      const prevYearSummary = await getPeriodBalanceSummary(companyId, [revenueAccount], year - 1);
      const prevYearRevenue = prevYearSummary[0]?.credit || 0;
      
      // Tính thuế lũy tiến thực sự
      const progressiveTax = calculateProgressiveTax(prevYearRevenue, netProfit);
      taxAmount = progressiveTax.totalTax;
      appliedTaxRate = progressiveTax.appliedRate;
      taxBreakdown = progressiveTax.breakdown;
      
      // Tạo bút toán thuế TNDN: Nợ TK 821, Có TK 3334
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Kết chuyển thuế TNDN')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, taxExpenseAccount, taxAmount, voucherId, corporateTaxPayableAccount, taxAmount]
      );
      
      // Bút toán kết chuyển TK 821 về TK 911: Nợ TK 911, Có TK 821
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Kết chuyển thuế TNDN từ chi phí thuế về TK kết chuyển')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId2 = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId2, closingAccount, taxAmount, voucherId2, taxExpenseAccount, taxAmount]
      );
    }
    
    // 5. Kết chuyển lãi/lỗ cuối cùng: TK 911 → TK 4212
    // Lấy số dư còn lại trên TK 911 sau khi đã kết chuyển
    const final911Summary = await getPeriodBalanceSummary(companyId, [closingAccount], year, month);
    const final911Balance = (final911Summary[0]?.debit || 0) - (final911Summary[0]?.credit || 0);
    
    if (Math.abs(final911Balance) > 0) {
      const closingDate = getClosingDate(year, month);
      
      if (final911Balance > 0) {
        // Lãi: Nợ TK 911, Có TK 4212
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, $2, $3, 'Kết chuyển lãi cuối kỳ sang TK lợi nhuận giữ lại')`,
          [companyId, closingVoucherType, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
          [voucherId, closingAccount, final911Balance, voucherId, retainedEarningsAccount, final911Balance]
        );
      } else {
        // Lỗ: Nợ TK 4212, Có TK 911
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, $2, $3, 'Kết chuyển lỗ cuối kỳ sang TK lợi nhuận giữ lại')`,
          [companyId, closingVoucherType, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
          [voucherId, retainedEarningsAccount, Math.abs(final911Balance), voucherId, closingAccount, Math.abs(final911Balance)]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Xóa cache toàn bộ hệ thống sau khi hoàn thành kết chuyển
    try {
      await invalidateCache(`dashboard:cashflow:${companyId}:*`);
      await invalidateCache(`balance-sheet:${companyId}:*`);
    } catch (cacheError) {
      console.error('Lỗi xóa cache sau kết chuyển:', cacheError);
    }
    
    return {
      success: true,
      message: 'Kết chuyển sổ tháng ' + month + '/' + year + ' thành công',
      details: {
        revenue_closing: accountRevenueCredit,
        cost_closing: totalCostDebit,
        profit_before_tax: netProfit,
        income_tax: taxAmount,
        final_balance_911: final911Balance
      }
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lấy số liệu để tính kết chuyển
 */
export async function getClosingData(companyId, month, year) {
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const revenueAccount = String(accounts.revenue || '511');
  const costAccounts = Array.isArray(accounts.cost) && accounts.cost.length > 0
    ? accounts.cost.map((acc) => String(acc))
    : ['632', '641', '642'];
  const closingAccount = String(accounts.closing || '911');

  const summaryRows = await getPeriodBalanceSummary(companyId, [revenueAccount, ...costAccounts, closingAccount], year, month);
  const summaryMap = Object.fromEntries(summaryRows.map((row) => [row.account_code, row]));

  return {
    account511: {
      debit: summaryMap[revenueAccount]?.debit || 0,
      credit: summaryMap[revenueAccount]?.credit || 0
    },
    costAccounts: costAccounts.map((accountCode) => ({
      account_code: accountCode,
      debit: summaryMap[accountCode]?.debit || 0,
      credit: summaryMap[accountCode]?.credit || 0
    })),
    account911: {
      debit: summaryMap[closingAccount]?.debit || 0,
      credit: summaryMap[closingAccount]?.credit || 0
    }
  };
}

/**
 * Tạo bút toán phân bổ chi phí trả trước (TK 242)
 * Phân bổ chi phí trả trước vào chi phí hoạt động
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function createAllowanceEntries(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const prepaidExpenseAccount = String(accounts.prepaidExpense || '242');
  const prepaidExpenseAllocationAccount = String(accounts.prepaidExpenseAllocation || '642');
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 242 (Chi phí trả trước)
    const prepaidBalance = await getBalanceByPrefix(client, companyId, prepaidExpenseAccount, month, year);
    const allowanceBalance = prepaidBalance.debit - prepaidBalance.credit;
    
    if (allowanceBalance > 0) {
      // Tạo bút toán phân bổ: Nợ TK 642, Có TK 242
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Phân bổ chi phí trả trước')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, prepaidExpenseAllocationAccount, allowanceBalance, voucherId, prepaidExpenseAccount, allowanceBalance]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Phân bổ chi phí trả trước thành công',
      allowance_balance: allowanceBalance
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Tạo bút toán khấu hao TSCĐ (TK 214)
 * Tính khấu hao tài sản cố định theo phương pháp khấu hao tuyến tính
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function createDepreciationEntries(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const rates = closingRules.rates || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const fixedAssetAccount = String(accounts.fixedAsset || '211');
  const depreciationExpenseAccount = String(accounts.depreciationExpense || '611');
  const accumulatedDepreciationAccount = String(accounts.accumulatedDepreciation || '214');
  const depreciationAnnualRate = Number(rates.depreciationAnnualRate ?? 0.2);
  
  try {
    await client.query('BEGIN');
    
    // Lấy danh sách TSCĐ cần khấu hao
    const query = `
      SELECT 
        v.id as voucher_id,
        v.voucher_date,
        vd.amount as original_value,
        EXTRACT(YEAR FROM v.voucher_date) as purchase_year
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $3
        AND EXTRACT(YEAR FROM v.voucher_date) <= $2
    `;

      const { rows } = await client.query(query, [companyId, year, `${fixedAssetAccount}%`]);
    
    // Tính khấu hao (giả sử khấu hao 20% giá trị gốc mỗi năm)
    for (const asset of rows) {
      const depreciationAmount = asset.original_value * depreciationAnnualRate / 12;
      
      if (depreciationAmount > 0) {
        const closingDate = getClosingDate(year, month);
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, $2, $3, 'Khấu hao TSCĐ')`,
          [companyId, closingVoucherType, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
          [voucherId, depreciationExpenseAccount, depreciationAmount, voucherId, accumulatedDepreciationAccount, depreciationAmount]
        );
      }
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Đã tạo bút toán khấu hao cho ${rows.length} tài sản`,
      assets_processed: rows.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Tạo bút toán dự phòng nợ khó đòi (TK 335)
 * Dự phòng 10% số dư phải thu khách hàng quá hạn
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function createProvisionEntries(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const rates = closingRules.rates || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const receivableAccount = String(accounts.receivable || '131');
  const provisionExpenseAccount = String(accounts.provisionExpense || '635');
  const doubtfulDebtProvisionAccount = String(accounts.doubtfulDebtProvision || '335');
  const biologicalAssetAccount = String(accounts.biologicalAsset || '215');
  const biologicalProvisionAccount = String(accounts.biologicalProvision || '2295');
  const doubtfulDebtRate = Number(rates.doubtfulDebtProvisionRate ?? 0.1);
  const biologicalProvisionRate = Number(rates.biologicalProvisionRate ?? 0.05);
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 131 (Phải thu khách hàng)
    const receivableBalance = await getBalanceByPrefix(client, companyId, receivableAccount, month, year);
    const arBalance = receivableBalance.debit - receivableBalance.credit;
    
    // Dự phòng 10% số dư phải thu
    const provisionAmount = arBalance * doubtfulDebtRate;
    
    if (provisionAmount > 0) {
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Dự phòng nợ khó đòi')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, provisionExpenseAccount, provisionAmount, voucherId, doubtfulDebtProvisionAccount, provisionAmount]
      );
    }
    
    // Dự phòng tài sản sinh học (TK 2295)
    const biologicalBalance = await getBalanceByPrefix(client, companyId, biologicalAssetAccount, month, year);
    const bioAssetBalance = biologicalBalance.debit - biologicalBalance.credit;
    
    // Dự phòng 5% tài sản sinh học
    const bioProvisionAmount = bioAssetBalance * biologicalProvisionRate;
    
    if (bioProvisionAmount > 0) {
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Dự phòng tài sản sinh học')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, provisionExpenseAccount, bioProvisionAmount, voucherId, biologicalProvisionAccount, bioProvisionAmount]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Tạo dự phòng thành công',
      ar_provision: provisionAmount,
      bio_provision: bioProvisionAmount
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Xử lý thuế TNCN tự động
 * Tính toán thuế TNCN dựa trên số dư tài khoản 3331
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function processTaxTNCN(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const tncnPayableAccount = String(accounts.personalIncomeTaxPayable || '3331');
  const taxPaymentOffsetAccount = String(accounts.taxPaymentOffset || '331');
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 3331 (Thuế TNCN phải nộp)
    const taxBalance = await getBalanceByPrefix(client, companyId, tncnPayableAccount, month, year);
    const taxPayable = taxBalance.debit - taxBalance.credit;
    
    if (taxPayable > 0) {
      // Tạo bút toán nộp thuế TNCN: Nợ TK 3331, Có TK 331
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Nộp thuế TNCN')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, tncnPayableAccount, taxPayable, voucherId, taxPaymentOffsetAccount, taxPayable]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Xử lý thuế TNCN thành công',
      tax_payable: taxPayable
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Xử lý thuế VAT tự động
 * Tính toán thuế VAT dựa trên số dư tài khoản 33311
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function processTaxVAT(companyId, month, year) {
  const client = await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');
  const vatPayableAccount = String(accounts.vatPayable || '33311');
  const taxPaymentOffsetAccount = String(accounts.taxPaymentOffset || '331');
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 33311 (Thuế GTGT phải nộp)
    const vatBalance = await getBalanceByPrefix(client, companyId, vatPayableAccount, month, year);
    const vatPayable = vatBalance.debit - vatBalance.credit;
    
    if (vatPayable > 0) {
      // Tạo bút toán nộp thuế VAT: Nợ TK 33311, Có TK 331
      const closingDate = getClosingDate(year, month);
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, $2, $3, 'Nộp thuế GTGT')`,
        [companyId, closingVoucherType, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
        [voucherId, vatPayableAccount, vatPayable, voucherId, taxPaymentOffsetAccount, vatPayable]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Xử lý thuế VAT thành công',
      vat_payable: vatPayable
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}