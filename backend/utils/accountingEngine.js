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
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null) {
  const hermaphroditicAccounts = ['131', '331', '138', '338'];
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
  
  if (isHermaphroditic) {
    // Trả về cả hai chiều chi tiết của đối tác, chống bù trừ chéo vô lý giữa các khách hàng/nhà cung cấp
    return { debit_balance: debitSum, credit_balance: creditSum };
  }

  if (isAsset) {
    return { balance: debitSum - creditSum };
  } else {
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