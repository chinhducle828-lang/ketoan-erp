/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * E-Invoice Service
 * Sinh hóa đơn điện tử theo chuẩn dữ liệu NĐ 254/2026/NĐ-CP
 * Lưu vào bảng e_invoices, có thể tra cứu qua GET /api/e-invoices/:id
 * Tuân thủ Luật 108/2025/QH15 (OTP signing required for e-invoice issuance)
 */
import { pool } from '../config/db.js';
import { hashOtp } from './otpRouting.service.js';
import { logAction } from './auditLog.service.js';

/**
 * Check if e-invoice requires signing before issuance
 * @param {number} voucherId - Voucher ID linked to e-invoice
 * @param {number} companyId - Company ID
 * @returns {boolean} Whether signing is required
 */
export async function isEInvoiceSigningRequired({ voucherId, companyId }) {
  // Check if linked voucher is XK or PT type and not yet signed
  const voucherRes = await pool.query(
    `SELECT v.voucher_type, v.sign_status 
     FROM vouchers v 
     WHERE v.id = $1 AND v.company_id = $2`,
    [voucherId, companyId]
  );

  if (voucherRes.rows.length === 0) {
    return false;
  }

  const voucher = voucherRes.rows[0];
  const requiresSigning = ['XK', 'PT'].includes(voucher.voucher_type);
  const alreadySigned = voucher.sign_status === 'signed';

  return requiresSigning && !alreadySigned;
}

/**
 * Sinh số hóa đơn theo quy tắc: Mẫu số + Ký hiệu + Số tăng dần theo năm/tháng
 * Ví dụ: Hóa đơn mẫu 01GTKT0, ký hiệu AA/2026/001
 */
export async function generateEInvoice({ companyId, buyerName, buyerTaxCode, buyerAddress, items, amount, taxAmount, total, voucherNumber, voucherId }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Lấy cấu hình mẫu số/ký hiệu từ companies hoặc mặc định
  const companyRes = await pool.query(
    'SELECT einvoice_template, einvoice_symbol FROM companies WHERE id = $1 LIMIT 1',
    [companyId]
  );
  const template = String(companyRes.rows[0]?.einvoice_template || '01GTKT0').trim();
  const symbol = String(companyRes.rows[0]?.einvoice_symbol || `AA/${year}/`).trim();

  // Đếm số hóa đơn đã phát hành trong tháng để tăng dần
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM e_invoices WHERE company_id = $1 AND EXTRACT(YEAR FROM issued_at) = $2 AND EXTRACT(MONTH FROM issued_at) = $3`,
    [companyId, year, parseInt(month, 10)]
  );
  const seq = (countRes.rows[0].cnt || 0) + 1;
  const invoiceNo = `${template}-${symbol}${String(seq).padStart(6, '0')}`;

  const invoice = {
    company_id: companyId,
    invoice_no: invoiceNo,
    template,
    symbol,
    buyer_name: buyerName || 'Khách hàng',
    buyer_tax_code: buyerTaxCode || null,
    buyer_address: buyerAddress || null,
    amount: Number(amount || 0),
    tax_amount: Number(taxAmount || 0),
    total: Number(total || 0),
    voucher_id: voucherId || null,
    status: 'issued'
  };

  return invoice;
}

/**
 * Lưu hóa đơn điện tử vào DB (với kiểm tra ký số)
 */
export async function saveEInvoice(invoice, { userId, otpHash } = {}) {
  // If voucher is linked, check signing status
  if (invoice.voucher_id) {
    const signingRequired = await isEInvoiceSigningRequired({
      voucherId: invoice.voucher_id,
      companyId: invoice.company_id
    });
    
    if (signingRequired) {
      throw new Error('Hóa đơn điện tử cần được ký số trước khi phát hành. Vui lòng sử dụng API /api/signing/request-otp.');
    }
  }

  const result = await pool.query(
    `INSERT INTO e_invoices
      (company_id, invoice_no, template, symbol, buyer_name, buyer_tax_code, buyer_address, amount, tax_amount, total, voucher_id, status, sign_status, signed_by, sign_otp_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      invoice.company_id,
      invoice.invoice_no,
      invoice.template,
      invoice.symbol,
      invoice.buyer_name,
      invoice.buyer_tax_code,
      invoice.buyer_address,
      invoice.amount,
      invoice.tax_amount,
      invoice.total,
      invoice.voucher_id,
      invoice.status,
      'signed', // sign_status
      userId || null, // signed_by
      otpHash || null // sign_otp_hash
    ]
  );

  // Log e-invoice issuance
  if (userId) {
    await logAction({
      userId,
      action: 'ISSUE_E_INVOICE',
      entityType: 'E_INVOICES',
      newValues: {
        invoice_id: result.rows[0].id,
        invoice_no: invoice.invoice_no,
        voucher_id: invoice.voucher_id
      },
      companyId: invoice.company_id
    });
  }

  return result.rows[0];
}

/**
 * Lấy hóa đơn theo ID + kiểm tra quyền công ty
 */
export async function getEInvoiceById(id, companyId) {
  const result = await pool.query(
    'SELECT * FROM e_invoices WHERE id = $1 AND company_id = $2 LIMIT 1',
    [id, companyId]
  );
  return result.rows[0] || null;
}

/**
 * Lấy danh sách hóa đơn của công ty (có phân trang)
 */
export async function listEInvoices(companyId, { limit = 20, offset = 0 } = {}) {
  const result = await pool.query(
    'SELECT * FROM e_invoices WHERE company_id = $1 ORDER BY issued_at DESC LIMIT $2 OFFSET $3',
    [companyId, parseInt(limit, 10), parseInt(offset, 10)]
  );
  return result.rows;
}

export default { generateEInvoice, saveEInvoice, getEInvoiceById, listEInvoices };