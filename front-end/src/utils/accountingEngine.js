// FILE_PATH: front-end/src/utils/accountingEngine.js

/**
 * Tính toán số dư tài khoản tổng hợp phục vụ hiển thị UI Bảng cân đối hạch toán
 * Hỗ trợ tài khoản lưỡng tính theo đối tác (TK 131, 331)
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Nạp số dư đầu kỳ dồn tích, hỗ trợ partner_id cho tài khoản lưỡng tính
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.accountCode || ob.account_code;
      const partnerId = ob.partner_id || ob.partnerId || null;
      
      if (!accCode) return;

      // Kiểm tra tài khoản lưỡng tính
      const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
      const isHermaphroditic = hermaphroditicAccounts.some(acc => accCode.startsWith(acc));
      
      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
      const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

      if (!ledger[ledgerKey]) {
        ledger[ledgerKey] = { 
          patsinhDr: 0, 
          patsinhCr: 0, 
          closingDr: 0, 
          closingCr: 0,
          accountCode: accCode,
          partnerId: partnerId
        };
      }
      ledger[ledgerKey].patsinhDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[ledgerKey].patsinhCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[ledgerKey].closingDr = ledger[ledgerKey].patsinhDr;
      ledger[ledgerKey].closingCr = ledger[ledgerKey].patsinhCr;
    });
  }

  // Lũy kế các chứng từ phát sinh trong kỳ (Hỗ trợ số âm điều chỉnh)
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;
      const partnerId = detail.partnerId || detail.partner_id || null;

      if (!accCode) return;

      // Kiểm tra tài khoản lưỡng tính
      const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
      const isHermaphroditic = hermaphroditicAccounts.some(acc => accCode.startsWith(acc));

      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
      const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

      if (!ledger[ledgerKey]) {
        ledger[ledgerKey] = { 
          patsinhDr: 0, 
          patsinhCr: 0, 
          closingDr: 0, 
          closingCr: 0,
          accountCode: accCode,
          partnerId: isHermaphroditic ? partnerId : null
        };
      }

      if (entryType === 'DR') {
        ledger[ledgerKey].patsinhDr += amount;
        ledger[ledgerKey].closingDr += amount;
      } else if (entryType === 'CR') {
        ledger[ledgerKey].patsinhCr += amount;
        ledger[ledgerKey].closingCr += amount;
      }
    });
  });

  return ledger;
}

/**
 * Lấy số dư cuối kỳ theo tính chất tài khoản và cấu trúc lưỡng tính đặc biệt TT99
 * Hỗ trợ truy vấn theo partnerId cho tài khoản lưỡng tính
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset', partnerId = null) {
  // Xây dựng key tìm kiếm cho tài khoản lưỡng tính theo đối tác
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
  // Tìm key phù hợp trong ledger
  let ledgerKey = accountCode;
  if (isHermaphroditic && partnerId) {
    ledgerKey = `${accountCode}_${partnerId}`;
  }
  
  if (!ledger[ledgerKey]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[ledgerKey];
  
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
