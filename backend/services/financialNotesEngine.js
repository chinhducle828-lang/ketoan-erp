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

// 3.1 Bảng tiền (TK 111, 112) - Đã fix: gộp opening_balances
export async function getCashBalances(companyId, year = null) {
  const getCombinedBalance = async (accountPrefix) => {
    let params = [companyId, `${accountPrefix}%`];
    let paramIdx = 3;
    
    let periodFilter = '';
    if (year) {
      periodFilter = ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIdx}`;
      params.push(year);
      paramIdx++;
    }

    const query = `
      WITH opening AS (
        SELECT 
          SUM(opening_debit) as opening_debit,
          SUM(opening_credit) as opening_credit
        FROM opening_balances
        WHERE company_id = $1 AND account_code LIKE $2
      ),
      period AS (
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code LIKE $2
          ${periodFilter}
      )
      SELECT 
        COALESCE(o.opening_debit, 0) + COALESCE(p.debit_total, 0) as total_debit,
        COALESCE(o.opening_credit, 0) + COALESCE(p.credit_total, 0) as total_credit
      FROM opening o
      CROSS JOIN period p
    `;
    
    const { rows } = await pool.query(query, params);
    const debit = parseFloat(rows[0]?.total_debit) || 0;
    const credit = parseFloat(rows[0]?.total_credit) || 0;
    return debit - credit;
  };

  const cashBalance = await getCombinedBalance('111');
  const bankBalance = await getCombinedBalance('112');

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

// 3.2 Biến động TSCĐ & tài sản sinh học (TK 211, 215) - Đã fix: gộp opening_balances
export async function getFixedAssetChanges(companyId, year = null) {
  const getCombinedBalance = async (accountPrefix) => {
    let params = [companyId, `${accountPrefix}%`];
    let paramIdx = 3;
    let periodFilter = '';
    if (year) {
      periodFilter = ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIdx}`;
      params.push(year);
      paramIdx++;
    }

    const query = `
      WITH opening AS (
        SELECT 
          SUM(opening_debit) as opening_debit,
          SUM(opening_credit) as opening_credit
        FROM opening_balances
        WHERE company_id = $1 AND account_code LIKE $2
      ),
      period AS (
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code LIKE $2
          ${periodFilter}
      )
      SELECT 
        COALESCE(o.opening_debit, 0) + COALESCE(p.debit_total, 0) as total_debit,
        COALESCE(o.opening_credit, 0) + COALESCE(p.credit_total, 0) as total_credit
      FROM opening o
      CROSS JOIN period p
    `;
    const { rows } = await pool.query(query, params);
    const debit = parseFloat(rows[0]?.total_debit) || 0;
    const credit = parseFloat(rows[0]?.total_credit) || 0;
    return debit - credit;
  };

  const getCombinedDepreciation = async () => {
    let params = [companyId, '214%'];
    let paramIdx = 3;
    let periodFilter = '';
    if (year) {
      periodFilter = ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIdx}`;
      params.push(year);
      paramIdx++;
    }

    const query = `
      WITH opening AS (
        SELECT 
          SUM(opening_debit) as opening_debit,
          SUM(opening_credit) as opening_credit
        FROM opening_balances
        WHERE company_id = $1 AND account_code LIKE $2
      ),
      period AS (
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as period_depreciation
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code LIKE $2
          ${periodFilter}
      )
      SELECT 
        (COALESCE(o.opening_credit, 0) - COALESCE(o.opening_debit, 0)) + 
        COALESCE(p.period_depreciation, 0) as total_depreciation
      FROM opening o
      CROSS JOIN period p
    `;
    const { rows } = await pool.query(query, params);
    return Math.abs(parseFloat(rows[0]?.total_depreciation) || 0);
  };

  const fixedAssetBalance = await getCombinedBalance('211');
  const bioAssetBalance = await getCombinedBalance('215');
  const depreciation = await getCombinedDepreciation();

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

// 3.3 Chi tiết thuế (TK 333 - bao gồm 3334 cho thuế tối thiểu toàn cầu 15%) - Đã fix: gộp opening_balances
export async function getTaxDetails(companyId, year = null) {
  const getCombinedTaxBalance = async (accountPrefix) => {
    let params = [companyId, `${accountPrefix}%`];
    let paramIdx = 3;
    let periodFilter = '';
    if (year) {
      periodFilter = ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIdx}`;
      params.push(year);
      paramIdx++;
    }

    const query = `
      WITH opening AS (
        SELECT 
          SUM(opening_debit) as opening_debit,
          SUM(opening_credit) as opening_credit
        FROM opening_balances
        WHERE company_id = $1 AND account_code LIKE $2
      ),
      period AS (
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
        FROM voucher_details vd
        JOIN vouchers v ON vd.voucher_id = v.id
        WHERE v.company_id = $1 
          AND vd.account_code LIKE $2
          ${periodFilter}
      )
      SELECT 
        COALESCE(o.opening_debit, 0) + COALESCE(p.debit_total, 0) as total_debit,
        COALESCE(o.opening_credit, 0) + COALESCE(p.credit_total, 0) as total_credit
      FROM opening o
      CROSS JOIN period p
    `;
    const { rows } = await pool.query(query, params);
    const debit = parseFloat(rows[0]?.total_debit) || 0;
    const credit = parseFloat(rows[0]?.total_credit) || 0;
    return debit - credit;
  };

  const vatPayable = await getCombinedTaxBalance('3331');
  const corporateTaxPayable = await getCombinedTaxBalance('3334');
  const incomeTaxPayable = await getCombinedTaxBalance('3335');

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
    totalTaxPayable: vatPayable + corporateTaxPayable
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