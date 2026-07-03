// FILE_PATH: backend/utils/accountingEngine.js
import pool from '../config/db.js';

/**
 * Kiểm tra xem ngày chứng từ có nằm trong vùng đã bị khóa sổ kế toán hay không
 * Thao tác Sửa/Xóa chứng từ nằm trong vùng khóa sổ sẽ bị chặn triệt để
 */
export async function checkLockDate(companyId, voucherDate) {
  const query = 'SELECT lock_date FROM companies WHERE id = $1';
  const { rows } = await pool.query(query, [companyId]);
  if (rows.length === 0 || !rows[0].lock_date) return false;

  const lockDate = new Date(rows[0].lock_date);
  const targetDate = new Date(voucherDate);
  return targetDate <= lockDate;
}

/**
 * Tính toán số dư tài khoản thông thường và tài khoản lưỡng tính công nợ
 * 
 * Tài khoản lưỡng tính:
 * - 131, 331, 138, 338: Công nợ phải thu/phải trả (đã có)
 * - 333: Thuế GTGT đầu ra (nộp thừa sẽ có số dư Nợ)
 * - 3381: Thuế TNDN (nộp thừa sẽ có số dư Nợ)
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null) {
  const hermaphroditicAccounts = ['131', '331', '138', '338', '333', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));

  let query = `
    SELECT vd.entry_type, SUM(vd.amount) as total_amount
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.account_code LIKE $2
  `;
  
  const params = [companyId, `${accountCode}%`];

  // Nếu là tài khoản lưỡng tính, bắt buộc phải lọc nghiêm ngặt theo đối tác cụ thể
  if (isHermaphroditic) {
    if (partnerId) {
      query += ` AND vd.partner_id = $3`;
      params.push(partnerId);
    }
  }

  query += ` GROUP BY vd.entry_type`;

  const { rows } = await pool.query(query, params);
  
  let debitSum = 0;
  let creditSum = 0;

  rows.forEach(row => {
    if (row.entry_type === 'DR') debitSum += parseFloat(row.total_amount) || 0;
    if (row.entry_type === 'CR') creditSum += parseFloat(row.total_amount) || 0;
  });

  // Xác định tính chất số dư mặc định của loại tài khoản để trả về giá trị thuần túy phù hợp
  const isAsset = accountCode.startsWith('1') || accountCode.startsWith('131') || accountCode.startsWith('2') || accountCode.startsWith('6') || accountCode.startsWith('8');
  
  // Tài khoản 421 (LNSTCPP) có thể có số dư Nợ khi lỗ
  const isProfitLoss = accountCode.startsWith('421');
  
  if (isHermaphroditic) {
    // Trả về cả hai chiều chi tiết của đối tác, chống bù trừ chéo vô lý giữa các khách hàng/nhà cung cấp
    // Đồng thời cho phép cả hai chiều (Dr/Cr) vì có thể nộp thừa thuế
    return { 
      debit_balance: debitSum, 
      credit_balance: creditSum,
      is_hermaphroditic: true 
    };
  }

  if (isAsset || isProfitLoss) {
    // Tài khoản Tài sản: Nợ - Có
    // Tài khoản 421 (LNSTCPP): Có thể có số dư Nợ khi lỗ
    return { balance: debitSum - creditSum };
  } else {
    // Tài khoản Nguồn vốn/Doanh thu: Có - Nợ
    return { balance: creditSum - debitSum };
  }
}

/**
 * Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ
 * Hàm này được gọi từ test-erp-core.js và erpController.js
 * @param {Array} vouchers - Danh sách chứng từ từ database
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

      // Hỗ trợ số âm cho phép điều chỉnh lỗi
      // Khi ghi chứng từ điều chỉnh, có thể dùng số âm để trừ ngược
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
 * Tính số dư cuối kỳ của tài khoản
 * Xử lý đặc biệt cho tài khoản lưỡng tính và tài khoản lỗ
 * 
 * @param {Object} ledger - Kết quả từ calculateBalances
 * @param {String} accountCode - Mã tài khoản
 * @param {String} accountType - Loại tài khoản (asset, liability, equity, revenue, expense)
 * @returns {Number} Số dư cuối kỳ (có thể âm)
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset') {
  if (!ledger[accountCode]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[accountCode];
  
  // Tài khoản lưỡng tính: trả về cả hai chiều để frontend xử lý
  const hermaphroditicAccounts = ['131', '331', '138', '338', '333', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
  if (isHermaphroditic) {
    // Trả về object với cả Dr và Cr để frontend biết cách hiển thị
    return {
      type: 'hermaphroditic',
      debit: patsinhDr,
      credit: patsinhCr,
      // Số dư thuần: Dr - Cr (nếu âm thì là bên Có)
      net: patsinhDr - patsinhCr
    };
  }
  
  // Tài khoản 421 (LNSTCPP) có thể có số dư Nợ khi lỗ
  const isProfitLoss = accountCode.startsWith('421');
  
  if (accountType === 'asset' || accountType === 'expense' || isProfitLoss) {
    // Tài sản/Chi phí/LNSTCPP: Nợ - Có (có thể âm)
    return patsinhDr - patsinhCr;
  } else {
    // Nguồn vốn/Doanh thu: Có - Nợ (có thể âm)
    return patsinhCr - patsinhDr;
  }
}
