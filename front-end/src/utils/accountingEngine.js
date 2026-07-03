/**
 * Accounting Engine - Frontend Version
 * Chứa các hàm tính toán kế toán thuần túy (không cần database)
 */

/**
 * Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ
 * @param {Array} vouchers - Danh sách chứng từ
 * @param {Array} openingBalances - Số dư đầu kỳ (tùy chọn)
 * @returns {Object} - Đối tượng chứa số dư từng tài khoản
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Khởi tạo số dư đầu kỳ nếu có
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.account_code || ob.accountCode;
      if (!ledger[accCode]) {
        ledger[accCode] = {
          patsinhDr: 0,
          patsinhCr: 0,
          closingDr: 0,
          closingCr: 0
        };
      }
      ledger[accCode].patsinhDr = parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[accCode].patsinhCr = parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[accCode].closingDr = ledger[accCode].patsinhDr;
      ledger[accCode].closingCr = ledger[accCode].patsinhCr;
    });
  }

  // Duyệt qua từng chứng từ và tính dồn tích
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;

      if (!ledger[accCode]) {
        ledger[accCode] = {
          patsinhDr: 0,
          patsinhCr: 0,
          closingDr: 0,
          closingCr: 0
        };
      }

      if (entryType === 'DR') {
        ledger[accCode].patsinhDr += amount;
        ledger[accCode].closingDr += amount;
      } else if (entryType === 'CR') {
        ledger[accCode].patsinhCr += amount;
        ledger[accCode].closingCr += amount;
      }
    });
  });

  return ledger;
}

/**
 * Tính tổng phát sinh Nợ của một tài khoản
 */
export function getTotalDebit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhDr || 0;
}

/**
 * Tính tổng phát sinh Có của một tài khoản
 */
export function getTotalCredit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhCr || 0;
}

/**
 * Tính số dư cuối kỳ của tài khoản
 * Tài khoản Tài sản/Chi phí: Nợ - Có
 * Tài khoản Nguồn vốn/Doanh thu: Có - Nợ
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset') {
  if (!ledger[accountCode]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[accountCode];
  
  if (accountType === 'asset' || accountType === 'expense') {
    return patsinhDr - patsinhCr;
  } else {
    return patsinhCr - patsinhDr;
  }
}