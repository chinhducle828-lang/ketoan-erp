import { pool } from '../config/db.js';
import { getBalanceSheetRules } from '../config/businessRules.js';

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
  const rules = getBalanceSheetRules();
  const dualAccounts = rules.customerDualAccounts || {};
  const receivableAccount = String(dualAccounts.receivable || '131');
  const customerAdvanceAccount = String(dualAccounts.customerAdvance || '312');
  const payableAccount = String(dualAccounts.payable || '331');

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
    if (accountCode === receivableAccount) {
      if (balance > 0) {
        // Số dư Nợ - Tài sản (Phải thu khách hàng)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'asset', // Tài sản
          account_code: receivableAccount
        });
      } else if (balance < 0) {
        // Số dư Có - Gán vào TK 312 (Người mua trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'advance', // Người mua trả tiền trước
          account_code: customerAdvanceAccount
        });
      }
    }
    // Tài khoản 312 (Người mua trả tiền trước) - Tài sản lưỡng tính
    else if (accountCode === customerAdvanceAccount) {
      if (balance > 0) {
        // Số dư Nợ - Tài sản (Người mua trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'asset', // Tài sản
          account_code: customerAdvanceAccount
        });
      } else if (balance < 0) {
        // Số dư Có - Nguồn vốn
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'liability', // Nguồn vốn
          account_code: customerAdvanceAccount
        });
      }
    }
    // Tài khoản 331 (Phải trả người bán) - Nợ phải trả lưỡng tính
    else if (accountCode === payableAccount) {
      if (balance > 0) {
        // Số dư Nợ - Nợ phải trả (Phải trả người bán)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: balance,
          balance_type: 'liability', // Nợ phải trả
          account_code: payableAccount
        });
      } else if (balance < 0) {
        // Số dư Có - Có phải thu (Khách hàng trả tiền trước)
        results.push({
          customer_id: row.customer_id,
          partner_name: row.partner_name,
          partner_code: row.partner_code,
          amount: Math.abs(balance),
          balance_type: 'asset', // Tài sản
          account_code: payableAccount
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
  const rules = getBalanceSheetRules();
  const depreciationRules = rules.depreciation || {};
  const sourcePrefix = String(depreciationRules.sourcePrefix || '214');
  const displayAccountCode = String(depreciationRules.displayAccountCode || '223');

  // Lấy số dư tài khoản 214 (TSCĐ)
  const query = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE $2
  `;
  
  const { rows } = await pool.query(query, [companyId, `${sourcePrefix}%`]);
  
  if (rows.length > 0) {
    const debit = parseFloat(rows[0].debit_total) || 0;
    const credit = parseFloat(rows[0].credit_total) || 0;
    
    // Hao mòn TSCĐ (223) - Tài sản
    // Giá trị = (Tổng Có - Tổng Nợ) * -1 để hiển thị âm
    const depreciationValue = (credit - debit) * -1;
    
    return {
      account_code: displayAccountCode,
      amount: Math.abs(depreciationValue),
      is_negative: depreciationValue < 0,
      raw_debit: debit,
      raw_credit: credit
    };
  }
  
  return {
    account_code: displayAccountCode,
    amount: 0,
    is_negative: false,
    raw_debit: 0,
    raw_credit: 0
  };
}

/**
 * LỖI 3: Xử lý nhóm Thuế (TK 333)
 * Không lấy số dư tổng của TK 333
 * Bóc tách chi tiết: 3331 (GTGT), 3334 (TNDN), 3339 (Thuế môn bài)
 */
export async function getTaxAccountBalances(companyId) {
  const rules = getBalanceSheetRules();
  const taxCodes = Array.isArray(rules.taxAccounts) && rules.taxAccounts.length > 0
    ? rules.taxAccounts.map((code) => String(code || '').trim()).filter(Boolean)
    : ['3331', '3334', '3339'];
  const taxNames = rules.taxAccountNames || {};

  const taxAccounts = Object.fromEntries(
    taxCodes.map((code) => [code, { name: String(taxNames[code] || `Thuế ${code}`), amount: 0 }])
  );
  
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
  const rules = getBalanceSheetRules();
  const accountGroups = rules.accountGroups || {};
  const assetPrefixes = Array.isArray(accountGroups.assetPrefixes) ? accountGroups.assetPrefixes : ['1', '2'];
  const liabilityPrefixes = Array.isArray(accountGroups.liabilityPrefixes) ? accountGroups.liabilityPrefixes : ['3'];
  const equityPrefixes = Array.isArray(accountGroups.equityPrefixes) ? accountGroups.equityPrefixes : ['4'];
  const excludeAssetPrefixes = Array.isArray(accountGroups.excludeAssetPrefixes) ? accountGroups.excludeAssetPrefixes : ['214', '223'];

  const startsWithAny = (value, prefixes) => prefixes.some((prefix) => String(value || '').startsWith(String(prefix || '')));

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
    if (startsWithAny(accCode, assetPrefixes)) {
      if (!startsWithAny(accCode, excludeAssetPrefixes)) {
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
    else if (startsWithAny(accCode, liabilityPrefixes)) {
      if (balance !== 0) {
        liabilities.push({
          account_code: accCode,
          amount: Math.abs(balance),
          is_credit: balance < 0
        });
      }
    }
    // Vốn (4xx)
    else if (startsWithAny(accCode, equityPrefixes)) {
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

/**
 * Lấy số dư tài khoản theo mã tài khoản (Hỗ trợ TK 215, 2295 cho nông nghiệp)
 */
export async function getAccountBalance(companyId, accountCode, year = null) {
  let query = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE $2
  `;
  
  const params = [companyId, `${accountCode}%`];
  
  if (year) {
    query += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${params.length + 1}`;
    params.push(year);
  }
  
  const { rows } = await pool.query(query, params);
  
  if (rows.length > 0) {
    const debit = parseFloat(rows[0].debit_total) || 0;
    const credit = parseFloat(rows[0].credit_total) || 0;
    return {
      account_code: accountCode,
      debit_balance: debit,
      credit_balance: credit,
      net_balance: debit - credit
    };
  }
  
  return {
    account_code: accountCode,
    debit_balance: 0,
    credit_balance: 0,
    net_balance: 0
  };
}

/**
 * Lấy số dư tài khoản 215 (Tài sản sinh học)
 */
export async function getBiologicalAssetBalance(companyId, year = null) {
  return getAccountBalance(companyId, '215', year);
}

/**
 * Lấy số dư tài khoản 2295 (Dự phòng tổn thất tài sản nông nghiệp)
 */
export async function getAgriculturalProvisionBalance(companyId, year = null) {
  return getAccountBalance(companyId, '2295', year);
}