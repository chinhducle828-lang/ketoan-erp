/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/utils/accountingEngine.js

/**
 * Tính toán số dư tài khoản tổng hợp phục vụ hiển thị UI Bảng cân đối hạch toán
 * Hỗ trợ tài khoản lưỡng tính theo đối tác (TK 131, 331)
 * 
 * @NOTE Số dư đầu kỳ (openingDr/openingCr) được tách riêng khỏi phát sinh trong kỳ (patsinhDr/patsinhCr).
 * getTotalDebit() và getTotalCredit() chỉ đọc patsinhDr/patsinhCr nên KHÔNG bị nhiễm số dư đầu kỳ.
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditicAccountCode = (accCode) => {
    if (!accCode) return false;
    return hermaphroditicAccounts.some(acc => accCode.startsWith(acc));
  };

  // Nạp số dư đầu kỳ (riêng biệt, KHÔNG cộng vào patsinhDr/patsinhCr)
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.accountCode || ob.account_code;
      const partnerId = ob.partner_id || ob.partnerId || null;

      if (!accCode) return;

      // Kiểm tra tài khoản lưỡng tính
      const isHermaphroditic = isHermaphroditicAccountCode(accCode);

      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
      const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

      if (!ledger[ledgerKey]) {
        ledger[ledgerKey] = { 
          openingDr: 0,
          openingCr: 0,
          patsinhDr: 0, 
          patsinhCr: 0, 
          closingDr: 0, 
          closingCr: 0,
          accountCode: accCode,
          partnerId: partnerId
        };
      }
      // Chỉ cộng vào openingDr/openingCr - KHÔNG cộng vào patsinhDr/patsinhCr
      ledger[ledgerKey].openingDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[ledgerKey].openingCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      // closingDr = openingDr + patsinhDr (patsinhDr chưa có gì ở bước này)
      ledger[ledgerKey].closingDr = ledger[ledgerKey].openingDr;
      ledger[ledgerKey].closingCr = ledger[ledgerKey].openingCr;
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
      const isHermaphroditic = isHermaphroditicAccountCode(accCode);

      // Tạo key duy nhất cho tài khoản lưỡng tính theo đối tác
      const ledgerKey = isHermaphroditic && partnerId ? `${accCode}_${partnerId}` : accCode;

      if (!ledger[ledgerKey]) {
        ledger[ledgerKey] = { 
          openingDr: 0,
          openingCr: 0,
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
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
  // Tìm key phù hợp trong ledger
  let ledgerKey = accountCode;
  if (isHermaphroditic && partnerId) {
    ledgerKey = `${accountCode}_${partnerId}`;
  }
  
  if (!ledger[ledgerKey]) return 0;
  
  const { openingDr, openingCr, patsinhDr, patsinhCr, closingDr, closingCr } = ledger[ledgerKey];
  
  if (isHermaphroditic) {
    return {
      type: 'hermaphroditic',
      opening: { debit: openingDr, credit: openingCr },
      period: { debit: patsinhDr, credit: patsinhCr },
      debit: closingDr,
      credit: closingCr,
      net: closingDr - closingCr
    };
  }
  
  const isProfitLoss = accountCode.startsWith('421');
  
  if (accountType === 'asset' || accountType === 'expense' || isProfitLoss) {
    return closingDr - closingCr;
  } else {
    return closingCr - closingDr;
  }
}

// BỔ SUNG ĐỒNG BỘ FRONTEND: Lấy tổng phát sinh Nợ
export function getTotalDebit(ledger, accountCode) {
  const entries = Object.entries(ledger || {}).filter(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    const entryAccountCode = value.accountCode || value.account_code || key.split('_')[0];
    return String(entryAccountCode) === String(accountCode);
  });

  if (entries.length === 0) return 0;
  return entries.reduce((sum, [, value]) => sum + Number(value.patsinhDr || 0), 0);
}

// BỔ SUNG ĐỒNG BỘ FRONTEND: Lấy tổng phát sinh Có
export function getTotalCredit(ledger, accountCode) {
  const entries = Object.entries(ledger || {}).filter(([key, value]) => {
    if (!value || typeof value !== 'object') return false;
    const entryAccountCode = value.accountCode || value.account_code || key.split('_')[0];
    return String(entryAccountCode) === String(accountCode);
  });

  if (entries.length === 0) return 0;
  return entries.reduce((sum, [, value]) => sum + Number(value.patsinhCr || 0), 0);
}