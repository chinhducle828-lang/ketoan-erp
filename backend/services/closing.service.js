/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module ClosingService
 * @description Dịch vụ kết chuyển sổ cuối kỳ (Month-End Closing Service).
 * Thực hiện các bút toán kết chuyển tự động: doanh thu, chi phí, thuế TNDN, lãi/lỗ.
 * 
 * @IMPORTANT Sau khi kết chuyển thành công, service sẽ tự động cập nhật monthly_balances
 * để đảm bảo số dư cuối kỳ bao gồm cả số dư đầu kỳ (opening balances).
 * 
 * @FLOW:
 * 1. Kiểm tra khóa sổ và distributed lock
 * 2. Tạo bút toán kết chuyển doanh thu (511 → 911)
 * 3. Tạo bút toán kết chuyển chi phí (632/641/642 → 911)
 * 4. Tính và hạch toán thuế TNDN (lũy tiến theo doanh thu năm trước)
 * 5. Kết chuyển lãi/lỗ cuối cùng (911 → 4212)
 * 6. Cập nhật monthly_balances với số dư đầu kỳ
 */
import { pool } from '../config/db.js';
import { invalidateCache } from '../cache/redis.js';
import { getPeriodBalanceSummary } from './summary.service.js';
import { getClosingRules } from '../config/businessRules.js';
import { withLock, acquireLock, releaseLock } from './distributedLock.service.js';
import { invalidateBalance } from './balanceCache.service.js';
import { updateMonthlyBalanceForMonth } from './maintenance.service.js';
import { getTaxRateByRevenue, calculateProgressiveTax } from '../utils/accountingEngine.js';
import { getConfigNumber, getConfigString } from '../utils/configHelper.js';

const getClosingDate = (year, month) => {
  // Tính ngày cuối cùng của tháng (xử lý đúng tháng 2, tháng 30 ngày...)
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * Helper: Create a voucher with one or more detail lines in a single transaction.
 * Uses INSERT ... RETURNING id to avoid LASTVAL() race conditions.
 * @param {Object} client - DB client (must be in transaction)
 * @param {number} companyId
 * @param {string} voucherType
 * @param {string} date
 * @param {string} description
 * @param {Array<{account_code: string, entry_type: string, amount: number}>} entries
 * @returns {Promise<number>} voucherId
 */
const createVoucherWithDetails = async (client, companyId, voucherType, date, description, entries) => {
  const vResult = await client.query(
    `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [companyId, voucherType, date, description]
  );
  const voucherId = vResult.rows[0].id;

  if (entries && entries.length > 0) {
    const valuesArr = [];
    const queryArgs = [];
    let idx = 1;
    for (const entry of entries) {
      valuesArr.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      queryArgs.push(voucherId, entry.account_code, entry.entry_type, entry.amount);
      idx += 4;
    }
    await client.query(
      `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
       VALUES ${valuesArr.join(', ')}`,
      queryArgs
    );
  }

  return voucherId;
};

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
  * KẾT CHUYỂN SỔ CUỐI KỲ - ERP KẾ TOÁN
  * LỖI 4: Thuật toán kết chuyển tự động
  */

/**
 * Hàm thực hiện kết chuyển sổ cuối kỳ
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng kết chuyển
 * @param {number} year - Năm kết chuyển
 */
export async function runClosingEntries(companyId, month, year, dbClient = null, options = {}) {
  const useExternalClient = Boolean(dbClient);
  const { skipLock = useExternalClient } = options;

  let lock = null;
  if (!skipLock) {
    // Sử dụng distributed lock để đảm bảo chỉ một process chạy cho mỗi công ty
    lock = await acquireLock('closing', { companyId, ttl: 60000 });

    if (!lock) {
      throw new Error('Có tiến trình kết chuyển đang chạy. Vui lòng thử lại sau.');
    }
  }

  const client = dbClient || await pool.connect();
  const closingRules = getClosingRules();
  const closingAccounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || 'DauKy');

  // Đọc entity_type của công ty để áp dụng phân loại thuế A–D
  let companyEntityType = 'company';
  try {
    const companyMetaRes = await client.query('SELECT entity_type FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    if (companyMetaRes.rows.length > 0) {
      companyEntityType = String(companyMetaRes.rows[0].entity_type || 'company').trim().toLowerCase();
    }
  } catch {
    companyEntityType = 'company';
  }
  const revenueAccount = String(closingAccounts.revenue || getConfigString('accounts.revenue_short', '511', companyId));
  const costAccounts = Array.isArray(closingAccounts.cost) && closingAccounts.cost.length > 0
    ? closingAccounts.cost.map((acc) => String(acc))
    : ['632', '641', '642'].map(acc => getConfigString(`accounts.${acc === '632' ? 'cogs' : acc === '641' ? 'sales_expense' : 'admin_expense'}`, acc, companyId));
  const otherIncomeAccount = String(closingAccounts.otherIncome || getConfigString('accounts.other_income', '711', companyId));
  const otherExpenseAccount = String(closingAccounts.otherExpense || getConfigString('accounts.other_expense', '811', companyId));
  const taxExpenseAccount = String(closingAccounts.taxExpense || getConfigString('accounts.tax_expense', '821', companyId));
  const closingAccount = String(closingAccounts.closing || getConfigString('accounts.closing', '911', companyId));
  const corporateTaxPayableAccount = String(closingAccounts.corporateTaxPayable || getConfigString('accounts.corporate_tax_payable', '3334', companyId));
  const retainedEarningsAccount = String(closingAccounts.retainedEarnings || getConfigString('accounts.retained_earnings', '4212', companyId));
  
  try {
    if (!useExternalClient) {
      await client.query('BEGIN');
    }
    
    // [PESSIMISTIC LOCK] Khóa bản ghi công ty để tránh race condition
    // Nếu có 2 request đồng thời, request thứ 2 sẽ nhận lỗi ngay lập tức
    await client.query(
      'SELECT id, lock_date FROM companies WHERE id = $1 FOR UPDATE NOWAIT',
      [companyId]
    );
    
    // [PESSIMISTIC LOCK] Khóa monthly_balances để tránh race condition
    await client.query(
      'SELECT id FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = $3 FOR UPDATE',
      [companyId, year, month]
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
    const ceResult = await client.query(
      `INSERT INTO closing_entries (company_id, year, month, status, started_at)
       VALUES ($1, $2, $3, 'processing', NOW()) RETURNING id`,
      [companyId, year, month]
    );
    
    const closingEntryId = ceResult.rows[0].id;
    
    const summaryRows = await getPeriodBalanceSummary(
      companyId,
      [revenueAccount, ...costAccounts, otherIncomeAccount, otherExpenseAccount, taxExpenseAccount, closingAccount],
      year,
      month,
      client
    );
    const summaryMap = Object.fromEntries(summaryRows.map((row) => [row.account_code, row]));

    const accountRevenueCredit = summaryMap[revenueAccount]?.credit || 0;
    const account711Credit = summaryMap[otherIncomeAccount]?.credit || 0;
    const account811Debit = summaryMap[otherExpenseAccount]?.debit || 0;
    
    const closingDate = getClosingDate(year, month);

    // 2a. Kết chuyển doanh thu bán hàng: Nợ 511 / Có 911
    if (accountRevenueCredit > 0) {
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển doanh thu bán hàng sang TK kết chuyển', [
        { account_code: revenueAccount, entry_type: 'DR', amount: accountRevenueCredit },
        { account_code: closingAccount, entry_type: 'CR', amount: accountRevenueCredit },
      ]);
    }
    
    // 2b. Kết chuyển thu nhập khác: Nợ 711 / Có 911
    if (account711Credit > 0) {
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển thu nhập khác sang TK kết chuyển', [
        { account_code: otherIncomeAccount, entry_type: 'DR', amount: account711Credit },
        { account_code: closingAccount, entry_type: 'CR', amount: account711Credit },
      ]);
    }
    
    // 2c. Kết chuyển chi phí khác: Nợ 911 / Có 811
    if (account811Debit > 0) {
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển chi phí khác sang TK kết chuyển', [
        { account_code: closingAccount, entry_type: 'DR', amount: account811Debit },
        { account_code: otherExpenseAccount, entry_type: 'CR', amount: account811Debit },
      ]);
    }
    
    // 3. Kết chuyển chi phí: Khấu trừ số dư Nợ các TK chi phí sang TK kết chuyển
    let totalCostDebit = 0;

    for (const acc of costAccounts) {
      totalCostDebit += summaryMap[acc]?.debit || 0;
    }
    
    if (totalCostDebit > 0) {
      // Tạo 1 voucher kết chuyển chi phí tổng hợp duy nhất (multi-line)
      // Nợ 911 (tổng chi phí) / Có 632, Có 641, Có 642 (từng khoản chi phí)
      const costEntries = [
        { account_code: closingAccount, entry_type: 'DR', amount: totalCostDebit },
      ];
      for (const acc of costAccounts) {
        const costAmount = summaryMap[acc]?.debit || 0;
        if (costAmount > 0) {
          costEntries.push({ account_code: acc, entry_type: 'CR', amount: costAmount });
        }
      }
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển chi phí sang TK kết chuyển', costEntries);
    }
    
    // 4. Tính thuế TNDN tự động - CẬP NHẬT: Thêm tài khoản 711, 811, 821
    // Công thức: Lãi = Doanh thu (511) + Thu nhập khác (711) - Chi phí (632, 641, 642) - Chi phí khác (811) - Thuế (821)
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
      const prevYearSummary = await getPeriodBalanceSummary(companyId, [revenueAccount], year - 1, null, client);
      const prevYearRevenue = prevYearSummary[0]?.credit || 0;
      
      // Tính thuế lũy tiến thực sự (theo entity_type của công ty)
      const progressiveTax = calculateProgressiveTax(prevYearRevenue, netProfit, companyEntityType);
      taxAmount = progressiveTax.totalTax;
      appliedTaxRate = progressiveTax.appliedRate;
      taxBreakdown = progressiveTax.breakdown;
      
      // Tạo bút toán thuế TNDN: Nợ TK 821, Có TK 3334
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển thuế TNDN', [
        { account_code: taxExpenseAccount, entry_type: 'DR', amount: taxAmount },
        { account_code: corporateTaxPayableAccount, entry_type: 'CR', amount: taxAmount },
      ]);
      
      // Bút toán kết chuyển TK 821 về TK 911: Nợ TK 911, Có TK 821
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Kết chuyển thuế TNDN từ chi phí thuế về TK kết chuyển', [
        { account_code: closingAccount, entry_type: 'DR', amount: taxAmount },
        { account_code: taxExpenseAccount, entry_type: 'CR', amount: taxAmount },
      ]);
    }
    
    // 5. Kết chuyển lãi/lỗ cuối cùng: TK 911 → TK 4212
    // Lấy số dư còn lại trên TK 911 sau khi đã kết chuyển
    const final911Summary = await getPeriodBalanceSummary(companyId, [closingAccount], year, month, client);
    const final911Balance = (final911Summary[0]?.debit || 0) - (final911Summary[0]?.credit || 0);
    
    if (Math.abs(final911Balance) > 0) {
      if (final911Balance > 0) {
        // Lãi: Nợ TK 911, Có TK 4212
        await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
          'Kết chuyển lãi cuối kỳ sang TK lợi nhuận giữ lại', [
          { account_code: closingAccount, entry_type: 'DR', amount: final911Balance },
          { account_code: retainedEarningsAccount, entry_type: 'CR', amount: final911Balance },
        ]);
      } else {
        // Lỗ: Nợ TK 4212, Có TK 911
        await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
          'Kết chuyển lỗ cuối kỳ sang TK lợi nhuận giữ lại', [
          { account_code: retainedEarningsAccount, entry_type: 'DR', amount: Math.abs(final911Balance) },
          { account_code: closingAccount, entry_type: 'CR', amount: Math.abs(final911Balance) },
        ]);
      }
    }
    
    if (!useExternalClient) {
      await client.query('COMMIT');
    }
    
    // Cập nhật monthly_balances sau khi kết chuyển (tính cả số dư đầu kỳ)
    if (!useExternalClient) {
      try {
        const closeClient = await pool.connect();
        try {
          await closeClient.query('BEGIN');
          await updateMonthlyBalanceForMonth(companyId, month, year, closeClient);
          await closeClient.query('COMMIT');
        } finally {
          closeClient.release();
        }
      } catch (mbError) {
        console.error('Lỗi cập nhật monthly_balances sau kết chuyển:', mbError);
        // Không throw lỗi - closing đã thành công, chỉ log warning
      }
    }
    
    // Chỉ xóa cache ngay tại service khi service tự quản transaction riêng.
    if (!useExternalClient) {
      try {
        await invalidateCache(`dashboard:cashflow:${companyId}:*`);
        await invalidateCache(`balance-sheet:${companyId}:*`);
        await invalidateBalance(companyId, year, month);
      } catch (cacheError) {
        console.error('Lỗi xóa cache sau kết chuyển:', cacheError);
      }
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
    if (!useExternalClient) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
    // Giải phóng distributed lock
    if (lock) {
      await releaseLock(lock);
    }
  }
}

/**
 * Lấy số liệu để tính kết chuyển
 */
export async function getClosingData(companyId, month, year) {
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const revenueAccount = String(accounts.revenue || getConfigString('accounts.revenue_short', '511', companyId));
  const costAccounts = Array.isArray(accounts.cost) && accounts.cost.length > 0
    ? accounts.cost.map((acc) => String(acc))
    : ['632', '641', '642'].map(acc => getConfigString(`accounts.${acc === '632' ? 'cogs' : acc === '641' ? 'sales_expense' : 'admin_expense'}`, acc, companyId));
  const closingAccount = String(accounts.closing || getConfigString('accounts.closing', '911', companyId));

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
  const closingVoucherType = String(closingRules.voucherType || getConfigString('voucher.closing_voucher_type', 'DauKy', companyId));
  const prepaidExpenseAccount = String(accounts.prepaidExpense || getConfigString('accounts.prepaid_expense', '242', companyId));
  const prepaidExpenseAllocationAccount = String(accounts.prepaidExpenseAllocation || getConfigString('accounts.admin_expense', '642', companyId));
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 242 (Chi phí trả trước)
    const prepaidBalance = await getBalanceByPrefix(client, companyId, prepaidExpenseAccount, month, year);
    const allowanceBalance = prepaidBalance.debit - prepaidBalance.credit;
    
    if (allowanceBalance > 0) {
      const closingDate = getClosingDate(year, month);
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Phân bổ chi phí trả trước', [
        { account_code: prepaidExpenseAllocationAccount, entry_type: 'DR', amount: allowanceBalance },
        { account_code: prepaidExpenseAccount, entry_type: 'CR', amount: allowanceBalance },
      ]);
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
export async function createDepreciationEntries(companyId, month, year, dbClient = null) {
  const useExternalClient = Boolean(dbClient);
  const client = dbClient || await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const rates = closingRules.rates || {};
  const closingVoucherType = String(closingRules.voucherType || getConfigString('voucher.closing_voucher_type', 'DauKy', companyId));
  const fixedAssetAccount = String(accounts.fixedAsset || getConfigString('accounts.fixed_asset', '211', companyId));
  const depreciationExpenseAccount = String(accounts.depreciationExpense || getConfigString('accounts.depreciation_expense_short', '611', companyId));
  const accumulatedDepreciationAccount = String(accounts.accumulatedDepreciation || getConfigString('accounts.accumulated_depreciation', '214', companyId));
  const depreciationAnnualRate = Number(rates.depreciationAnnualRate ?? 0.2);
  
  try {
    if (!useExternalClient) {
      await client.query('BEGIN');
    }
    
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
        await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
          'Khấu hao TSCĐ', [
          { account_code: depreciationExpenseAccount, entry_type: 'DR', amount: depreciationAmount },
          { account_code: accumulatedDepreciationAccount, entry_type: 'CR', amount: depreciationAmount },
        ]);
      }
    }
    
    if (!useExternalClient) {
      await client.query('COMMIT');
    }
    
    return {
      success: true,
      message: `Đã tạo bút toán khấu hao cho ${rows.length} tài sản`,
      assets_processed: rows.length
    };
  } catch (error) {
    if (!useExternalClient) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
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
  const closingVoucherType = String(closingRules.voucherType || getConfigString('voucher.closing_voucher_type', 'DauKy', companyId));
  const receivableAccount = String(accounts.receivable || getConfigString('accounts.ar', '131', companyId));
  const provisionExpenseAccount = String(accounts.provisionExpense || getConfigString('accounts.fin_expense', '635', companyId));
  const doubtfulDebtProvisionAccount = String(accounts.doubtfulDebtProvision || getConfigString('accounts.doubtful_debt_provision', '335', companyId));
  const biologicalAssetAccount = String(accounts.biologicalAsset || getConfigString('accounts.biological_asset', '215', companyId));
  const biologicalProvisionAccount = String(accounts.biologicalProvision || getConfigString('accounts.biological_provision', '2295', companyId));
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
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Dự phòng nợ khó đòi', [
        { account_code: provisionExpenseAccount, entry_type: 'DR', amount: provisionAmount },
        { account_code: doubtfulDebtProvisionAccount, entry_type: 'CR', amount: provisionAmount },
      ]);
    }
    
    // Dự phòng tài sản sinh học (TK 2295)
    const biologicalBalance = await getBalanceByPrefix(client, companyId, biologicalAssetAccount, month, year);
    const bioAssetBalance = biologicalBalance.debit - biologicalBalance.credit;
    
    // Dự phòng 5% tài sản sinh học
    const bioProvisionAmount = bioAssetBalance * biologicalProvisionRate;
    
    if (bioProvisionAmount > 0) {
      const closingDate = getClosingDate(year, month);
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        'Dự phòng tài sản sinh học', [
        { account_code: provisionExpenseAccount, entry_type: 'DR', amount: bioProvisionAmount },
        { account_code: biologicalProvisionAccount, entry_type: 'CR', amount: bioProvisionAmount },
      ]);
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
 * Xử lý thuế chung (Generic)
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 * @param {string} taxAccount - Tài khoản thuế phải nộp (VD: '3331', '33311')
 * @param {string} description - Mô tả bút toán
 * @param {string} resultField - Tên trường kết quả (VD: 'tax_payable', 'vat_payable')
 */
export async function processTaxGeneric(companyId, month, year, taxAccount, description, resultField, dbClient = null) {
  const useExternalClient = Boolean(dbClient);
  const client = dbClient || await pool.connect();
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const closingVoucherType = String(closingRules.voucherType || getConfigString('voucher.closing_voucher_type', 'DauKy', companyId));
  const taxPaymentOffsetAccount = String(accounts.taxPaymentOffset || getConfigString('accounts.ap', '331', companyId));
  
  try {
    if (!useExternalClient) {
      await client.query('BEGIN');
    }
    
    // Lấy số dư tài khoản thuế
    // LƯU Ý: TK thuế (333x) có bản chất dư CÓ (thuế phải nộp)
    // Nếu dư Có > dư Nợ → còn phải nộp thuế → mới hạch toán
    // Công thức: số thuế phải nộp = credit - debit
    const taxBalance = await getBalanceByPrefix(client, companyId, taxAccount, month, year);
    const taxPayable = taxBalance.credit - taxBalance.debit; // FIX: credit - debit cho TK thuế có bản chất dư Có
    
    if (taxPayable > 0) {
      const closingDate = getClosingDate(year, month);
      await createVoucherWithDetails(client, companyId, closingVoucherType, closingDate,
        description, [
        { account_code: taxAccount, entry_type: 'DR', amount: taxPayable },
        { account_code: taxPaymentOffsetAccount, entry_type: 'CR', amount: taxPayable },
      ]);
    }
    
    if (!useExternalClient) {
      await client.query('COMMIT');
    }
    
    return {
      success: true,
      message: `${description} thành công`,
      [resultField]: taxPayable
    };
  } catch (error) {
    if (!useExternalClient) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
  }
}

/**
 * Xử lý thuế TNCN tự động (Wrapper)
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function processTaxTNCN(companyId, month, year, dbClient = null) {
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const tncnPayableAccount = String(accounts.personalIncomeTaxPayable || getConfigString('accounts.corporate_tax_payable', '3331', companyId));
  
  return processTaxGeneric(
    companyId, 
    month, 
    year, 
    tncnPayableAccount, 
    'Nộp thuế TNCN', 
    'tax_payable',
    dbClient
  );
}

/**
 * Xử lý thuế VAT tự động (Wrapper)
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function processTaxVAT(companyId, month, year, dbClient = null) {
  const closingRules = getClosingRules();
  const accounts = closingRules.accounts || {};
  const vatPayableAccount = String(accounts.vatPayable || getConfigString('accounts.vat_payable', '33311', companyId));
  
  return processTaxGeneric(
    companyId, 
    month, 
    year, 
    vatPayableAccount, 
    'Nộp thuế GTGT', 
    'vat_payable',
    dbClient
  );
}
