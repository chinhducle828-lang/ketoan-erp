import { pool } from '../config/db.js';
import { invalidateCache } from '../cache/redis.js';

// Hằng số cấu hình thuế suất (Linh hoạt, dễ thay đổi)
const DEFAULT_TAX_RATE = 0.2; // Thuế suất mặc định 20%

/**
 * Tính thuế suất TNDN theo mức lũy tiến dựa trên doanh thu năm trước
 * - 15%: Doanh thu ≤ 3 tỷ VNĐ
 * - 17%: Doanh thu từ trên 3 tỷ đến 50 tỷ VNĐ
 * - 20%: Doanh thu trên 50 tỷ VNĐ
 * @param {number} revenue - Doanh thu năm trước (VNĐ)
 * @returns {number} - Thuế suất áp dụng
 */
export function getTaxRateByRevenue(revenue) {
  if (revenue <= 3000000000) return 0.15;
  if (revenue <= 50000000000) return 0.17;
  return 0.20;
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
  
  try {
    await client.query('BEGIN');
    
    // 1. Tính toán số dư TK 911 (Kết chuyển)
    const account911Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '911'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: account911Rows } = await client.query(account911Query, [companyId, month, year]);
    const account911Balance = (parseFloat(account911Rows[0]?.total_debit) || 0) - 
                            (parseFloat(account911Rows[0]?.total_credit) || 0);
    
    // 2. Kết chuyển doanh thu: Khấu trừ số dư Có TK 511 sang TK 911
    const account511Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '511'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: account511Rows } = await client.query(account511Query, [companyId, month, year]);
    const account511Credit = parseFloat(account511Rows[0]?.total_credit) || 0;
    
    if (account511Credit > 0) {
      // Tạo bút toán kết chuyển doanh thu: Nợ TK 911, Có TK 511
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển doanh thu sang TK 911')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '911', 'DR', $2), ($3, '511', 'CR', $4)`,
        [voucherId, account511Credit, voucherId, account511Credit]
      );
    }
    
    // 3. Kết chuyển chi phí: Khấu trừ số dư Nợ TK 632, 641, 642 sang TK 911
    const costAccounts = ['632', '641', '642'];
    let totalCostDebit = 0;
    
    for (const acc of costAccounts) {
      const costQuery = `
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code = $2
          AND EXTRACT(MONTH FROM v.voucher_date) = $3
          AND EXTRACT(YEAR FROM v.voucher_date) = $4
      `;
      
      const { rows: costRows } = await client.query(costQuery, [companyId, acc, month, year]);
      totalCostDebit += parseFloat(costRows[0]?.total_debit) || 0;
    }
    
    if (totalCostDebit > 0) {
      // Tạo bút toán kết chuyển chi phí: Nợ TK 632/641/642, Có TK 911
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển chi phí sang TK 911')`,
        [companyId, closingDate]
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
             VALUES ($1, $2, 'DR', $3), ($4, '911', 'CR', $5)`,
            [voucherId, acc, costAmount, voucherId, costAmount]
          );
        }
      }
    }
    
    // 4. Tính thuế TNDN tự động - CẬP NHẬT: Thêm tài khoản 711, 811, 821
    // Công thức: Lãi = Doanh thu (511) + Thu nhập khác (711) - Chi phí (632, 641, 642) - Chi phí khác (811) - Thuế (821)
    
    // Lấy thu nhập khác (711) - Có
    const account711Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '711'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: account711Rows } = await client.query(account711Query, [companyId, month, year]);
    const account711Credit = parseFloat(account711Rows[0]?.total_credit) || 0;
    
    // Lấy chi phí khác (811) - Nợ
    const account811Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '811'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: account811Rows } = await client.query(account811Query, [companyId, month, year]);
    const account811Debit = parseFloat(account811Rows[0]?.total_debit) || 0;
    
    // Lấy chi phí thuế (821) - Nợ
    const account821Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '821'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: account821Rows } = await client.query(account821Query, [companyId, month, year]);
    const account821Debit = parseFloat(account821Rows[0]?.total_debit) || 0;
    
    // Tính lợi nhuận trước thuế: Doanh thu + Thu nhập khác - Chi phí - Chi phí khác - Thuế
    const revenueCredit = account511Credit;
    const otherIncome = account711Credit;
    const otherExpenses = account811Debit;
    const taxExpense = account821Debit;
    
    const netProfit = revenueCredit + otherIncome - totalCostDebit - otherExpenses - taxExpense;
    
    // Chỉ hạch toán thuế TNDN khi có lợi nhuận (netProfit > 0)
    // Nếu lỗ (netProfit < 0), gán bút toán thuế bằng 0
    let taxAmount = 0;
    let appliedTaxRate = DEFAULT_TAX_RATE;
    
    if (netProfit > 0) {
      // Tính thuế suất lũy tiến dựa trên doanh thu năm trước
      // Lấy doanh thu năm trước từ TK 511
      const prevYearRevenueQuery = `
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_revenue
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code = '511'
          AND EXTRACT(YEAR FROM v.voucher_date) = $2
      `;
      
      const { rows: prevYearRows } = await client.query(prevYearRevenueQuery, [companyId, year - 1]);
      const prevYearRevenue = parseFloat(prevYearRows[0]?.total_revenue) || 0;
      
      // Xác định thuế suất áp dụng
      appliedTaxRate = getTaxRateByRevenue(prevYearRevenue);
      taxAmount = netProfit * appliedTaxRate;
      
      // Tạo bút toán thuế TNDN: Nợ TK 8211, Có TK 3334
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển thuế TNDN')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '8211', 'DR', $2), ($3, '3334', 'CR', $4)`,
        [voucherId, taxAmount, voucherId, taxAmount]
      );
      
      // Bút toán kết chuyển TK 8211 về TK 911: Nợ TK 911, Có TK 8211
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển thuế TNDN từ 8211 về 911')`,
        [companyId, closingDate]
      );
      
      const voucherId2 = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '911', 'DR', $2), ($3, '8211', 'CR', $4)`,
        [voucherId2, taxAmount, voucherId2, taxAmount]
      );
    }
    
    // 5. Kết chuyển lãi/lỗ cuối cùng: TK 911 → TK 4212
    // Lấy số dư còn lại trên TK 911 sau khi đã kết chuyển
    const final911Query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code = '911'
    `;
    
    const { rows: final911Rows } = await client.query(final911Query, [companyId]);
    const final911Balance = (parseFloat(final911Rows[0]?.total_debit) || 0) - 
                           (parseFloat(final911Rows[0]?.total_credit) || 0);
    
    if (Math.abs(final911Balance) > 0) {
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      
      if (final911Balance > 0) {
        // Lãi: Nợ TK 911, Có TK 4212
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, 'DauKy', $2, 'Kết chuyển lãi cuối kỳ sang TK 4212')`,
          [companyId, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, '911', 'DR', $2), ($3, '4212', 'CR', $4)`,
          [voucherId, final911Balance, voucherId, final911Balance]
        );
      } else {
        // Lỗ: Nợ TK 4212, Có TK 911
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, 'DauKy', $2, 'Kết chuyển lỗ cuối kỳ sang TK 4212')`,
          [companyId, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, '4212', 'DR', $2), ($3, '911', 'CR', $4)`,
          [voucherId, Math.abs(final911Balance), voucherId, Math.abs(final911Balance)]
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
        revenue_closing: account511Credit,
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
  // Lấy số dư TK 511
  const account511 = await pool.query(`
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.account_code = '511'
      AND EXTRACT(MONTH FROM v.voucher_date) = $2
      AND EXTRACT(YEAR FROM v.voucher_date) = $3
  `, [companyId, month, year]);
  
  // Lấy số dư TK 632, 641, 642
  const costAccounts = await pool.query(`
    SELECT 
      vd.account_code,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.account_code IN ('632', '641', '642')
      AND EXTRACT(MONTH FROM v.voucher_date) = $2
      AND EXTRACT(YEAR FROM v.voucher_date) = $3
    GROUP BY vd.account_code
  `, [companyId, month, year]);
  
  // Lấy số dư TK 911
  const account911 = await pool.query(`
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.account_code = '911'
      AND EXTRACT(MONTH FROM v.voucher_date) = $2
      AND EXTRACT(YEAR FROM v.voucher_date) = $3
  `, [companyId, month, year]);
  
  return {
    account511: {
      debit: parseFloat(account511.rows[0]?.debit) || 0,
      credit: parseFloat(account511.rows[0]?.credit) || 0
    },
    costAccounts: costAccounts.rows.map(row => ({
      account_code: row.account_code,
      debit: parseFloat(row.debit) || 0,
      credit: parseFloat(row.credit) || 0
    })),
    account911: {
      debit: parseFloat(account911.rows[0]?.debit) || 0,
      credit: parseFloat(account911.rows[0]?.credit) || 0
    }
  };
}