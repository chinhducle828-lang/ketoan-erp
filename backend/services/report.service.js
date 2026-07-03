import { pool } from '../config/db.js';

/**
 * BÁO CÁO TÀI CHÍNH - ERP KẾ TOÁN
 * Xử lý 3 lỗi: 131/312, 223, 333
 */

/**
 * LỖI 1: Tính chỉ tiêu Phải thu khách hàng (131) & Người mua trả tiền trước (312)
 * GROUP BY account_code, customer_id thay vì chỉ account_code
 * Tách khách hàng có số dư Nợ → Tài sản, số dư Có → TK 312 (Người mua trả tiền trước)
 */
export async function getCustomerAccountBalances(companyId, accountCode) {
  // Lấy số dư theo từng khách hàng
  const query = `
    SELECT 
      vd.partner_id as customer_id,
      p.partner_name,
      p.partner_code,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    LEFT JOIN partners p ON vd.partner_id = p.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE $2
      AND vd.partner_id IS NOT NULL
    GROUP BY vd.partner_id, p.partner_name, p.partner_code
    ORDER BY p.partner_name
  `;
  
  const { rows } = await pool.query(query, [companyId, `${accountCode}%`]);
  
  const results = [];
  for (const row of rows) {
    const balance = row.debit_total - row.credit_total;
    
    // Tài khoản 131 (Phải thu khách hàng) - Tài sản lưỡng tính
    // Số dư Nợ → Tài sản (131), Số dư Có → TK 312 (Người mua trả tiền trước)
    if (accountCode === '131') {
      if (balance > 0) {
        // Số dư Nợ - Tài sản (Phải thu khách hàng)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'asset', // Tài sản
          account_code: '131'
        });
      } else if (balance < 0) {
        // Số dư Có - Gán vào TK 312 (Người mua trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'advance', // Người mua trả tiền trước
          account_code: '312'
        });
      }
    }
    // Tài khoản 312 (Người mua trả tiền trước) - Tài sản lưỡng tính
    else if (accountCode === '312') {
      if (balance > 0) {
        // Số dư Nợ - Tài sản (Người mua trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'asset', // Tài sản
          account_code: '312'
        });
      } else if (balance < 0) {
        // Số dư Có - Nguồn vốn
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'liability', // Nguồn vốn
          account_code: '312'
        });
      }
    }
    // Tài khoản 331 (Phải trả người bán) - Nợ phải trả lưỡng tính
    else if (accountCode === '331') {
      if (balance > 0) {
        // Số dư Nợ - Nợ phải trả (Phải trả người bán)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'liability', // Nợ phải trả
          account_code: '331'
        });
      } else if (balance < 0) {
        // Số dư Có - Có phải thu (Khách hàng trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'asset', // Tài sản
          account_code: '331'
        });
      }
    }
  }
  
  return results;
}

/**
 * LỖI 2: Tính chỉ tiêu Hao mòn TSCĐ (223)
 * Tài khoản 214 thì lấy giá trị = (Tổng Có - Tổng Nợ) * -1 để hiển thị âm
 */
export async function getDepreciationBalance(companyId) {
  // Lấy số dư tài khoản 214 (TSCĐ)
  const query = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '214%'
  `;
  
  const { rows } = await pool.query(query, [companyId]);
  
  if (rows.length > 0) {
    const debit = parseFloat(rows[0].debit_total) || 0;
    const credit = parseFloat(rows[0].credit_total) || 0;
    
    // Hao mòn TSCĐ (223) - Tài sản
    // Giá trị = (Tổng Có - Tổng Nợ) * -1 để hiển thị âm
    const depreciationValue = (credit - debit) * -1;
    
    return {
      account_code: '223',
      amount: Math.abs(depreciationValue),
      is_negative: depreciationValue < 0,
      raw_debit: debit,
      raw_credit: credit
    };
  }
  
  return {
    account_code: '223',
    amount: 0,
    is_negative: false,
    raw_debit: 0,
    raw_credit: 0
  };
}

/**
 * LỖI 3: Xử lý nhóm Thuế (TK 333)
 * Không lấy số dư tổng của TK 333
 * Bóc tách chi tiết: 33311 (GTGT), 3334 (TNDN), 3339 (Thuế môn bài)
 */
export async function getTaxAccountBalances(companyId) {
  const taxAccounts = {
    '33311': { name: 'Thuế GTGT', amount: 0 },
    '3334': { name: 'Thuế TNDN', amount: 0 },
    '3339': { name: 'Thuế môn bài', amount: 0 }
  };
  
  // Lấy số dư từng tài khoản con thuế
  for (const accountCode of Object.keys(taxAccounts)) {
    const query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
    `;
    
    const { rows } = await pool.query(query, [companyId, `${accountCode}%`]);
    
    if (rows.length > 0) {
      const debit = parseFloat(rows[0].debit_total) || 0;
      const credit = parseFloat(rows[0].credit_total) || 0;
      
      // Tài khoản thuế - Số dư Nợ là tiền phải nộp, Số dư Có là tiền thừa
      taxAccounts[accountCode].amount = debit - credit;
    }
  }
  
  return taxAccounts;
}

/**
 * Báo cáo Bảng cân đối kế toán tổng hợp
 */
export async function getBalanceSheetData(companyId, month = null, year = null) {
  // Tính toán số dư tài khoản tổng hợp
  const query = `
    SELECT 
      vd.account_code,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
    ${month ? `AND EXTRACT(MONTH FROM v.voucher_date) = $2` : ''}
    ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $${month ? 3 : 2}` : ''}
    GROUP BY vd.account_code
    ORDER BY vd.account_code
  `;
  
  const params = [companyId];
  if (month) params.push(month);
  if (year) params.push(year);
  
  const { rows } = await pool.query(query, params);
  
  // Phân loại tài khoản
  const assets = [];
  const liabilities = [];
  const equity = [];
  
  for (const row of rows) {
    const balance = row.total_debit - row.total_credit;
    const accCode = row.account_code;
    
    // Tài sản (1xx, 2xx)
    if (accCode.startsWith('1') || accCode.startsWith('2')) {
      if (!accCode.startsWith('214') && !accCode.startsWith('223')) {
        // Bỏ qua TSCĐ (214) và Hao mòn (223) vì sẽ xử lý riêng
        if (balance !== 0) {
          assets.push({
            account_code: accCode,
            amount: Math.abs(balance),
            is_debit: balance > 0
          });
        }
      }
    }
    // Nợ phải trả (3xx)
    else if (accCode.startsWith('3')) {
      if (balance !== 0) {
        liabilities.push({
          account_code: accCode,
          amount: Math.abs(balance),
          is_credit: balance < 0
        });
      }
    }
    // Vốn (4xx)
    else if (accCode.startsWith('4')) {
      if (balance !== 0) {
        equity.push({
          account_code: accCode,
          amount: Math.abs(balance),
          is_credit: balance < 0
        });
      }
    }
  }
  
  return {
    assets,
    liabilities,
    equity,
    depreciation: await getDepreciationBalance(companyId),
    tax_balances: await getTaxAccountBalances(companyId)
  };
}

/**
 * Lấy số dư đầu kỳ theo đối tác (Hỗ trợ tài khoản lưỡng tính 131, 331)
 */
export async function getOpeningBalancesByPartner(companyId, fiscalYear, accountCode) {
  const query = `
    SELECT 
      ob.account_code,
      ob.opening_debit,
      ob.opening_credit,
      p.id as partner_id,
      p.partner_name,
      p.partner_code
    FROM opening_balances ob
    LEFT JOIN partners p ON ob.partner_id = p.id
    WHERE ob.company_id = $1 
      AND ob.fiscal_year = $2
      AND ob.account_code = $3
    ORDER BY p.partner_name
  `;
  
  const { rows } = await pool.query(query, [companyId, fiscalYear, accountCode]);
  
  return rows.map(row => ({
    account_code: row.account_code,
    opening_debit: parseFloat(row.opening_debit) || 0,
    opening_credit: parseFloat(row.opening_credit) || 0,
    partner_id: row.partner_id,
    partner_name: row.partner_name,
    partner_code: row.partner_code
  }));
}
