import { pool } from '../config/db.js';
import { invalidateCache } from '../cache/redis.js';
import { getPeriodBalanceSummary } from './summary.service.js';

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
    
    const summaryRows = await getPeriodBalanceSummary(companyId, ['511', '632', '641', '642', '711', '811', '821', '911'], year, month);
    const summaryMap = Object.fromEntries(summaryRows.map((row) => [row.account_code, row]));

    const account511Credit = summaryMap['511']?.credit || 0;
    
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
      totalCostDebit += summaryMap[acc]?.debit || 0;
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
    const account711Credit = summaryMap['711']?.credit || 0;
    const account811Debit = summaryMap['811']?.debit || 0;
    const account821Debit = summaryMap['821']?.debit || 0;
    
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
      const prevYearSummary = await getPeriodBalanceSummary(companyId, ['511'], year - 1);
      const prevYearRevenue = prevYearSummary[0]?.credit || 0;
      
      // Xác định thuế suất áp dụng
      appliedTaxRate = getTaxRateByRevenue(prevYearRevenue);
      taxAmount = netProfit * appliedTaxRate;
      
      // Tạo bút toán thuế TNDN: Nợ TK 821, Có TK 3334
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển thuế TNDN')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '821', 'DR', $2), ($3, '3334', 'CR', $4)`,
        [voucherId, taxAmount, voucherId, taxAmount]
      );
      
      // Bút toán kết chuyển TK 821 về TK 911: Nợ TK 911, Có TK 821
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Kết chuyển thuế TNDN từ 821 về 911')`,
        [companyId, closingDate]
      );
      
      const voucherId2 = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '911', 'DR', $2), ($3, '821', 'CR', $4)`,
        [voucherId2, taxAmount, voucherId2, taxAmount]
      );
    }
    
    // 5. Kết chuyển lãi/lỗ cuối cùng: TK 911 → TK 4212
    // Lấy số dư còn lại trên TK 911 sau khi đã kết chuyển
    const final911Summary = await getPeriodBalanceSummary(companyId, ['911'], year, month);
    const final911Balance = (final911Summary[0]?.debit || 0) - (final911Summary[0]?.credit || 0);
    
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
  const summaryRows = await getPeriodBalanceSummary(companyId, ['511', '632', '641', '642', '911'], year, month);
  const summaryMap = Object.fromEntries(summaryRows.map((row) => [row.account_code, row]));

  return {
    account511: {
      debit: summaryMap['511']?.debit || 0,
      credit: summaryMap['511']?.credit || 0
    },
    costAccounts: ['632', '641', '642'].map((accountCode) => ({
      account_code: accountCode,
      debit: summaryMap[accountCode]?.debit || 0,
      credit: summaryMap[accountCode]?.credit || 0
    })),
    account911: {
      debit: summaryMap['911']?.debit || 0,
      credit: summaryMap['911']?.credit || 0
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
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 242 (Chi phí trả trước)
    const query242 = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE '242%'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: rows242 } = await client.query(query242, [companyId, month, year]);
    const allowanceBalance = (parseFloat(rows242[0]?.debit_total) || 0) - (parseFloat(rows242[0]?.credit_total) || 0);
    
    if (allowanceBalance > 0) {
      // Tạo bút toán phân bổ: Nợ TK 642, Có TK 242
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Phân bổ chi phí trả trước')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '642', 'DR', $2), ($3, '242', 'CR', $4)`,
        [voucherId, allowanceBalance, voucherId, allowanceBalance]
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
        AND vd.account_code LIKE '211%'
        AND EXTRACT(YEAR FROM v.voucher_date) <= $2
    `;
    
    const { rows } = await client.query(query, [companyId, year]);
    
    // Tính khấu hao (giả sử khấu hao 20% giá trị gốc mỗi năm)
    for (const asset of rows) {
      const depreciationAmount = asset.original_value * 0.2 / 12; // Khấu hao hàng tháng
      
      if (depreciationAmount > 0) {
        const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, 'DauKy', $2, 'Khấu hao TSCĐ')`,
          [companyId, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, '611', 'DR', $2), ($3, '214', 'CR', $4)`,
          [voucherId, depreciationAmount, voucherId, depreciationAmount]
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
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 131 (Phải thu khách hàng)
    const query131 = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE '131%'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: rows131 } = await client.query(query131, [companyId, month, year]);
    const arBalance = (parseFloat(rows131[0]?.debit_total) || 0) - (parseFloat(rows131[0]?.credit_total) || 0);
    
    // Dự phòng 10% số dư phải thu
    const provisionAmount = arBalance * 0.1;
    
    if (provisionAmount > 0) {
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Dự phòng nợ khó đòi')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '635', 'DR', $2), ($3, '335', 'CR', $4)`,
        [voucherId, provisionAmount, voucherId, provisionAmount]
      );
    }
    
    // Dự phòng tài sản sinh học (TK 2295)
    const query215 = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE '215%'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: rows215 } = await client.query(query215, [companyId, month, year]);
    const bioAssetBalance = (parseFloat(rows215[0]?.debit_total) || 0) - (parseFloat(rows215[0]?.credit_total) || 0);
    
    // Dự phòng 5% tài sản sinh học
    const bioProvisionAmount = bioAssetBalance * 0.05;
    
    if (bioProvisionAmount > 0) {
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Dự phòng tài sản sinh học')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '635', 'DR', $2), ($3, '2295', 'CR', $4)`,
        [voucherId, bioProvisionAmount, voucherId, bioProvisionAmount]
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
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 3331 (Thuế TNCN phải nộp)
    const taxQuery = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE '3331%'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: taxRows } = await client.query(taxQuery, [companyId, month, year]);
    const taxPayable = (parseFloat(taxRows[0]?.debit_total) || 0) - (parseFloat(taxRows[0]?.credit_total) || 0);
    
    if (taxPayable > 0) {
      // Tạo bút toán nộp thuế TNCN: Nợ TK 3331, Có TK 331
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Nộp thuế TNCN')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '3331', 'DR', $2), ($3, '331', 'CR', $4)`,
        [voucherId, taxPayable, voucherId, taxPayable]
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
  
  try {
    await client.query('BEGIN');
    
    // Lấy số dư TK 33311 (Thuế GTGT phải nộp)
    const vatQuery = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE '33311%'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: vatRows } = await client.query(vatQuery, [companyId, month, year]);
    const vatPayable = (parseFloat(vatRows[0]?.debit_total) || 0) - (parseFloat(vatRows[0]?.credit_total) || 0);
    
    if (vatPayable > 0) {
      // Tạo bút toán nộp thuế VAT: Nợ TK 33311, Có TK 331
      const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
      await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Nộp thuế GTGT')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '33311', 'DR', $2), ($3, '331', 'CR', $4)`,
        [voucherId, vatPayable, voucherId, vatPayable]
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