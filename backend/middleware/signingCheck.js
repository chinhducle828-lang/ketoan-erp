/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Signing Check Middleware - Guard middleware for OTP digital signature
 * Tuân thủ Luật 108/2025/QH15 (audit trail bất biến, hash OTP, multi-tenant isolation)
 */

import { pool } from '../config/db.js';

/**
 * Middleware to check if voucher requires signing before posting
 * Required for XK (xuất kho) and PT (phiếu thu) voucher types
 */
export const requireSignedVoucher = async (req, res, next) => {
  try {
    const voucherId = req.params.id || req.body.voucherId || req.body.id;
    const companyId = req.body.companyId || req.query.company_id || req.user?.company_id;

    if (!voucherId) {
      return next(); // No voucher ID, skip check
    }

    // Get voucher type and signing status
    const result = await pool.query(
      `SELECT voucher_type, sign_status, is_posted FROM vouchers 
       WHERE id = $1 AND company_id = $2`,
      [voucherId, companyId]
    );

    if (result.rows.length === 0) {
      return next(); // Voucher not found, let other middleware handle
    }

    const voucher = result.rows[0];
    
    // Check if this voucher type requires signing
    const requiresSigning = ['XK', 'PT'].includes(voucher.voucher_type);
    
    if (requiresSigning && voucher.sign_status !== 'signed') {
      return res.status(403).json({
        error: 'Chứng từ yêu cầu ký số trước khi ghi sổ',
        code: 'SIGNING_REQUIRED',
        voucherType: voucher.voucher_type,
        message: `Chứng từ loại ${voucher.voucher_type} cần được ký số trước khi ghi sổ. Vui lòng sử dụng API /api/signing/request-otp để yêu cầu OTP.`
      });
    }

    next();
  } catch (err) {
    console.error('Signing check error:', err);
    res.status(500).json({ error: 'Lỗi kiểm tra ký số' });
  }
};

/**
 * Middleware to check if e-invoice requires signing
 */
export const requireSignedEInvoice = async (req, res, next) => {
  try {
    const invoiceId = req.params.id || req.body.invoiceId;
    const companyId = req.body.companyId || req.query.company_id || req.user?.company_id;

    if (!invoiceId) {
      return next();
    }

    // Get e-invoice status
    const result = await pool.query(
      `SELECT status, sign_status FROM e_invoices 
       WHERE id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );

    if (result.rows.length === 0) {
      return next();
    }

    const invoice = result.rows[0];
    
    // E-invoices always require signing
    if (invoice.sign_status !== 'signed') {
      return res.status(403).json({
        error: 'Hóa đơn điện tử yêu cầu ký số trước khi phát hành',
        code: 'E_INVOICE_SIGNING_REQUIRED',
        message: 'Hóa đơn điện tử cần được ký số trước khi phát hành. Vui lòng sử dụng API /api/signing/request-otp.'
      });
    }

    next();
  } catch (err) {
    console.error('E-Invoice signing check error:', err);
    res.status(500).json({ error: 'Lỗi kiểm tra ký số hóa đơn' });
  }
};

/**
 * Check if voucher is already signed
 * @param {number} voucherId - Voucher ID
 * @param {number} companyId - Company ID
 * @returns {boolean}
 */
export async function isVoucherSigned(voucherId, companyId) {
  const result = await pool.query(
    `SELECT sign_status FROM vouchers 
     WHERE id = $1 AND company_id = $2`,
    [voucherId, companyId]
  );

  return result.rows.length > 0 && result.rows[0].sign_status === 'signed';
}

export default {
  requireSignedVoucher,
  requireSignedEInvoice,
  isVoucherSigned
};