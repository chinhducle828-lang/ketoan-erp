// FILE_PATH: front-end/src/utils/accountingEngine.js

/**
 * Tính toán số dư tài khoản tổng hợp phục vụ hiển thị UI Bảng cân đối hạch toán
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Nạp số dư đầu kỳ dồn tích
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.accountCode || ob.account_code;
      if (!accCode) return;

      if (!ledger[accCode]) {
        ledger[accCode] = { patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
      }
      ledger[accCode].patsinhDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[accCode].patsinhCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[accCode].closingDr = ledger[accCode].patsinhDr;
      ledger[accCode].closingCr = ledger[accCode].patsinhCr;
    });
  }

  // Lũy kế các chứng từ phát sinh trong kỳ (Hỗ trợ số âm điều chỉnh)
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;

      if (!accCode) return;

      if (!ledger[accCode]) {
        ledger[accCode] = { patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
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
 * Lấy số dư cuối kỳ theo tính chất tài khoản và cấu trúc lưỡng tính đặc biệt TT99
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset') {
  if (!ledger[accountCode]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[accountCode];
  
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
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

// BỔ SUNG ĐỒNG BỘ FRONTEND: Lấy tổng phát sinh Nợ
export function getTotalDebit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhDr || 0;
}

// BỔ SUNG ĐỒNG BỘ FRONTEND: Lấy tổng phát sinh Có
export function getTotalCredit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhCr || 0;
}