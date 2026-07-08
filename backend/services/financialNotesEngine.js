/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from '../config/db.js';

/**
 * BẢN THUYẾT MINH BÁO CÁO TÀI CHÍNH (B09-DN)
 * Chuẩn Thông tư 99/2025/TT-BTC
 */

/**
 * Cấu phần 1: Thông tin doanh nghiệp
 */
export async function getCompanyInfo(companyId) {
  const query = `
    SELECT 
      id,
      name,
      tax_code,
      address,
      lock_date
    FROM companies
    WHERE id = $1
  `;
  
  const { rows } = await pool.query(query, [companyId]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return {
    id: rows[0].id,
    name: rows[0].name,
    taxCode: rows[0].tax_code,
    address: rows[0].address,
    lockDate: rows[0].lock_date
  };
}

/**
 * Cấu phần 2: Chính sách kế toán
 */
export async function getAccountingPolicies(companyId) {
  // Lấy thông tin chính sách kế toán từ cơ sở dữ liệu
  // Tạm thời trả về thông tin mặc định
  return {
    goingConcern: true,
    inventoryMethod: 'weighted_average', // weighted_average, fifo, specific_identification
    depreciationMethod: 'straight_line', // straight_line, declining_balance
    fixedAssetPolicy: {
      usefulLife: '5-10-15-20 years',
      residualValue: 5
    },
    revenueRecognition: 'point_of_sale',
    foreignCurrency: 'functional_currency_vnd'
  };
}

/**
 * Cấu phần 3: Chi tiết số liệu
 */

// 3.1 Bảng tiền (TK 111, 112)
export async function getCashBalances(companyId, year = null) {
  const conditions = ['v.company_id = $1'];
  const params = [companyId];
  let paramIndex = 2;

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  // TK 111 - Tiền mặt
  const cashQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '111%'
  `;

  // TK 112 - Tiền gửi ngân hàng
  const bankQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '112%'
  `;

  const [cashRes, bankRes] = await Promise.all([
    pool.query(cashQuery, params),
    pool.query(bankQuery, params)
  ]);

  const cashBalance = (parseFloat(cashRes.rows[0]?.debit_total) || 0) - (parseFloat(cashRes.rows[0]?.credit_total) || 0);
  const bankBalance = (parseFloat(bankRes.rows[0]?.debit_total) || 0) - (parseFloat(bankRes.rows[0]?.credit_total) || 0);

  return {
    cash: {
      accountCode: '111',
      balance: cashBalance,
      description: 'Tiền mặt'
    },
    bank: {
      accountCode: '112',
      balance: bankBalance,
      description: 'Tiền gửi ngân hàng'
    },
    total: cashBalance + bankBalance
  };
}

// 3.2 Biến động TSCĐ & tài sản sinh học (TK 211, 215)
export async function getFixedAssetChanges(companyId, year = null) {
  const conditions = ['v.company_id = $1'];
  const params = [companyId];
  let paramIndex = 2;

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  // TK 211 - Tài sản cố định hữu hình
  const fixedAssetQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '211%'
  `;

  // TK 215 - Tài sản sinh học
  const bioAssetQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '215%'
  `;

  // TK 214 - Khấu hao TSCĐ
  const depreciationQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as depreciation
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '214%'
  `;

  const [fixedAssetRes, bioAssetRes, depreciationRes] = await Promise.all([
    pool.query(fixedAssetQuery, params),
    pool.query(bioAssetQuery, params),
    pool.query(depreciationQuery, params)
  ]);

  const fixedAssetBalance = (parseFloat(fixedAssetRes.rows[0]?.debit_total) || 0) - (parseFloat(fixedAssetRes.rows[0]?.credit_total) || 0);
  const bioAssetBalance = (parseFloat(bioAssetRes.rows[0]?.debit_total) || 0) - (parseFloat(bioAssetRes.rows[0]?.credit_total) || 0);
  const depreciation = Math.abs(parseFloat(depreciationRes.rows[0]?.depreciation) || 0);

  return {
    fixedAssets: {
      accountCode: '211',
      balance: fixedAssetBalance,
      description: 'Tài sản cố định hữu hình'
    },
    biologicalAssets: {
      accountCode: '215',
      balance: bioAssetBalance,
      description: 'Tài sản sinh học'
    },
    accumulatedDepreciation: {
      accountCode: '214',
      amount: depreciation,
      description: 'Hao mòn tài sản cố định'
    }
  };
}

// 3.3 Chi tiết thuế (TK 333 - bao gồm 3334 cho thuế tối thiểu toàn cầu 15%)
export async function getTaxDetails(companyId, year = null) {
  const conditions = ['v.company_id = $1'];
  const params = [companyId];
  let paramIndex = 2;

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  // TK 3331 - Thuế GTGT
  const vatQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '3331%'
  `;

  // TK 3334 - Thuế TNDN
  const corporateTaxQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '3334%'
  `;

  // TK 3335 - Thuế TNCN
  const incomeTaxQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND vd.account_code LIKE '3335%'
  `;

  const [vatRes, corporateTaxRes, incomeTaxRes] = await Promise.all([
    pool.query(vatQuery, params),
    pool.query(corporateTaxQuery, params),
    pool.query(incomeTaxQuery, params)
  ]);

  const vatPayable = (parseFloat(vatRes.rows[0]?.debit_total) || 0) - (parseFloat(vatRes.rows[0]?.credit_total) || 0);
  const corporateTaxPayable = (parseFloat(corporateTaxRes.rows[0]?.debit_total) || 0) - (parseFloat(corporateTaxRes.rows[0]?.credit_total) || 0);
  const incomeTaxPayable = (parseFloat(incomeTaxRes.rows[0]?.debit_total) || 0) - (parseFloat(incomeTaxRes.rows[0]?.credit_total) || 0);

  return {
    vat: {
      accountCode: '3331',
      amount: vatPayable,
      description: 'Thuế GTGT phải nộp'
    },
    corporateTax: {
      accountCode: '3334',
      amount: corporateTaxPayable,
      description: 'Thuế thu nhập doanh nghiệp (TNDN) - Bao gồm thuế tối thiểu 15%'
    },
    incomeTax: {
      accountCode: '3335',
      amount: incomeTaxPayable,
      description: 'Thuế thu nhập cá nhân (TNCN)'
    },
    totalTaxPayable: vatPayable + corporateTaxPay
  };
}

/**
 * Lấy toàn bộ dữ liệu bản thuyết minh BCTC
 */
export async function getFinancialNotesData(companyId, year = null) {
  const [companyInfo, accountingPolicies, cashBalances, fixedAssetChanges, taxDetails] = await Promise.all([
    getCompanyInfo(companyId),
    getAccountingPolicies(companyId),
    getCashBalances(companyId, year),
    getFixedAssetChanges(companyId, year),
    getTaxDetails(companyId, year)
  ]);

  return {
    companyInfo,
    accountingPolicies,
    cashBalances,
    fixedAssetChanges,
    taxDetails,
    reportDate: new Date().toISOString(),
    fiscalYear: year || new Date().getFullYear()
  };
}

// END_OF_FILE