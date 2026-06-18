/**
 * Bộ engine tính toán số dư động từ chứng từ (T-Account Ledger Flow)
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Khởi tạo số dư đầu kỳ từ thiết lập cấu hình
  openingBalances.forEach(bal => {
    ledger[bal.account_code] = {
      dr: parseFloat(bal.debit_balance || 0),
      cr: parseFloat(bal.credit_balance || 0)
    };
  });

  // Cộng dồn lũy kế phát sinh bên Nợ và phát sinh bên Có từ tệp chứng từ gốc
  vouchers.forEach(v => {
    const amount = parseFloat(v.amount || 0);
    
    if (!ledger[v.account_dr]) ledger[v.account_dr] = { dr: 0, cr: 0 };
    if (!ledger[v.account_cr]) ledger[v.account_cr] = { dr: 0, cr: 0 };

    ledger[v.account_dr].dr += amount;
    ledger[v.account_cr].cr += amount;
  });

  return ledger;
}