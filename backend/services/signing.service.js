/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Signing Service - API ký số cho chứng từ và hóa đơn điện tử
 * Tuân thủ Luật 108/2025/QH15 (audit trail bất biến, hash OTP, multi-tenant isolation)
 */

import { pool } from '../config/db.js';
import { hashOtp } from './otpRouting.service.js';
import { logAction, getClientIp } from './auditLog.service.js';

/**
 * Request OTP for document signing
 * @param {Object} params - Parameters
 * @param {number} params.userId - User ID requesting signature
 * @param {number} params.voucherId - Voucher ID to sign
 * @param {number} params.companyId - Company ID for multi-tenant isolation
 * @param {string} params.documentType - Type: 'voucher' or 'e-invoice'
 * @returns {Object} Result with success status
 */
export async function requestOtpForSigning({ userId, voucherId, companyId, documentType = 'voucher' }) {
  // Verify voucher exists and belongs to company
  const voucherRes = await pool.query(
    'SELECT id, company_id, sign_status FROM vouchers WHERE id = $1 AND company_id = $2',
    [voucherId, companyId]
  );

  if (voucherRes.rows.length === 0) {
    throw new Error('Chứng từ không tồn tại hoặc không thuộc công ty này');
  }

  const voucher = voucherRes.rows[0];
  
  // Check if already signed
  if (voucher.sign_status === 'signed') {
    throw new Error('Chứng từ đã được ký số. Không thể ký lại.');
  }

  // Import and use OtpRoutingService
  const { default: otpRoutingService } = await import('./otpRouting.service.js');
  
  const result = await otpRoutingService.sendSigningOtp({
    userId,
    documentId: voucherId.toString(),
    documentType,
    companyId
  });

  // Log the signing request
  await logAction({
    userId,
    action: 'REQUEST_SIGNING',
    entityType: 'VOUCHERS',
    newValues: {
      voucher_id: voucherId,
      document_type: documentType,
      sign_channel: result.channel
    },
    ipAddress: 'system',
    companyId
  });

  return {
    success: true,
    message: `Mã OTP đã được gửi qua ${result.channel === 'PUSH' ? 'Push Notification' : result.channel === 'SMS' ? 'SMS' : 'Email'}`,
    channel: result.channel
  };
}

/**
 * Verify OTP and sign document
 * @param {Object} params - Parameters
 * @param {number} params.userId - User ID verifying signature
 * @param {number} params.voucherId - Voucher ID to sign
 * @param {string} params.otp - OTP code to verify
 * @param {number} params.companyId - Company ID for multi-tenant isolation
 * @param {string} params.documentType - Type: 'voucher' or 'e-invoice'
 * @returns {Object} Result with success status
 */
export async function verifyAndSignDocument({ userId, voucherId, otp, companyId, documentType = 'voucher' }) {
  // Verify OTP
  const { verifyOtp } = await import('./otpRouting.service.js');
  const isValid = await verifyOtp({ userId, otp, documentId: voucherId.toString() });

  if (!isValid) {
    throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn');
  }

  // Get OTP hash for audit trail
  const otpHash = hashOtp(otp);

  // Update voucher with signing status
  const result = await pool.query(
    `UPDATE vouchers 
     SET sign_status = 'signed',
         signed_by = $1,
         signed_at = NOW(),
         sign_otp_hash = $2
     WHERE id = $3 AND company_id = $4
     RETURNING id, sign_status, signed_at, sign_channel`,
    [userId, otpHash, voucherId, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error('Không thể cập nhật trạng thái ký số');
  }

  // Log the signing action
  await logAction({
    userId,
    action: 'SIGN_DOCUMENT',
    entityType: 'VOUCHERS',
    newValues: {
      voucher_id: voucherId,
      sign_status: 'signed',
      sign_otp_hash: otpHash
    },
    ipAddress: 'system',
    companyId
  });

  return {
    success: true,
    message: 'Ký số chứng từ thành công',
    voucher: result.rows[0]
  };
}

/**
 * Check if voucher requires signing
 * @param {number} voucherId - Voucher ID
 * @param {number} companyId - Company ID
 * @returns {boolean} Whether signing is required
 */
export async function isSigningRequired({ voucherId, companyId }) {
  // For XK (xuất kho) and PT (phiếu thu) voucher types, signing is required
  const result = await pool.query(
    `SELECT voucher_type, sign_status FROM vouchers 
     WHERE id = $1 AND company_id = $2`,
    [voucherId, companyId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const voucher = result.rows[0];
  const requiresSigning = ['XK', 'PT'].includes(voucher.voucher_type);
  const alreadySigned = voucher.sign_status === 'signed';

  return requiresSigning && !alreadySigned;
}

/**
 * Get signing status of a voucher
 * @param {number} voucherId - Voucher ID
 * @param {number} companyId - Company ID
 * @returns {Object} Signing status info
 */
export async function getSigningStatus({ voucherId, companyId }) {
  const result = await pool.query(
    `SELECT sign_status, signed_by, signed_at, sign_channel, sign_otp_hash
     FROM vouchers 
     WHERE id = $1 AND company_id = $2`,
    [voucherId, companyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Cancel signing request (invalidate OTP)
 * @param {number} userId - User ID
 * @param {number} voucherId - Voucher ID
 * @param {number} companyId - Company ID
 */
export async function cancelSigningRequest({ userId, voucherId, companyId }) {
  await pool.query(
    `UPDATE otp_signatures 
     SET used_at = NOW(), sign_status = 'cancelled'
     WHERE document_id = $1 AND user_id = $2 AND company_id = $3 AND used_at IS NULL`,
    [voucherId.toString(), userId, companyId]
  );

  await logAction({
    userId,
    action: 'CANCEL_SIGNING',
    entityType: 'VOUCHERS',
    newValues: { voucher_id: voucherId },
    ipAddress: 'system',
    companyId
  });

  return { success: true, message: 'Đã hủy yêu cầu ký số' };
}

export default {
  requestOtpForSigning,
  verifyAndSignDocument,
  isSigningRequired,
  getSigningStatus,
  cancelSigningRequest
};