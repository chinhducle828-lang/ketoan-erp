import { pool } from '../config/db.js';

/**
 * Ghi log hành động người dùng vào bảng audit_logs
 * @param {Object} params - Thông tin log
 * @param {number} params.userId - ID người dùng thực hiện
 * @param {string} params.action - Hành động: LOGIN, CREATE, UPDATE, DELETE
 * @param {string} params.entityType - Loại đối tượng: VOUCHERS, USERS, PARTNERS, COMPANIES, ITEMS, INVENTORY_VOUCHERS
 * @param {Object|null} params.oldValues - Dữ liệu trước khi thay đổi
 * @param {Object|null} params.newValues - Dữ liệu sau khi thay đổi
 * @param {string} params.ipAddress - Địa chỉ IP thực hiện
 * @param {number|null} params.companyId - ID doanh nghiệp (tùy chọn)
 */
export async function logAction({ userId, action, entityType, oldValues = null, newValues = null, ipAddress, companyId = null }) {
  try {
    // Lấy IP từ request nếu không truyền vào
    const clientIp = ipAddress || 'unknown';
    
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, old_values, new_values, ip_address, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        action,
        entityType,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        clientIp,
        companyId || null
      ]
    );
  } catch (error) {
    // Log lỗi nhưng không làm gián đoạn quy trình chính
    console.error('Lỗi ghi audit log:', error.message);
  }
}

/**
 * Ghi log nghiệp vụ kinh doanh
 * @param {Object} params - Thông tin log
 * @param {number} params.companyId - ID doanh nghiệp
 * @param {number|null} params.userId - ID người dùng
 * @param {string} params.action - Hành động: CREATE, UPDATE, DELETE, POST, APPROVE
 * @param {string} params.entityType - Loại: VOUCHERS, ITEMS, PARTNERS, INVENTORY
 * @param {Object} params.details - Chi tiết nghiệp vụ
 * @param {string} params.ipAddress - IP thực hiện
 */
export async function logBusinessEvent({ companyId, userId, action, entityType, details = {}, ipAddress }) {
  try {
    await logAction({
      userId,
      action,
      entityType,
      oldValues: details.oldValues || null,
      newValues: details.newValues || null,
      ipAddress,
      companyId
    });
  } catch (error) {
    console.error('Lỗi ghi business log:', error.message);
  }
}

/**
 * Lấy IP thực tế từ request (xử lý proxy)
 */
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Ghi log hàng loạt cho nhiều định khoản
 * @param {Object} params - Thông tin log
 * @param {number} params.companyId - ID doanh nghiệp
 * @param {number} params.userId - ID người dùng
 * @param {string} params.action - Hành động: CREATE, UPDATE, DELETE
 * @param {Array} params.details - Mảng các định khoản
 * @param {string} params.ipAddress - IP thực hiện
 * @param {Object} params.voucherInfo - Thông tin chứng từ (voucher_number, voucher_type)
 */
export async function logVoucherDetails({ companyId, userId, action, details, ipAddress, voucherInfo }) {
  if (!details || !Array.isArray(details) || details.length === 0) return;
  
  try {
    for (const detail of details) {
      await logAction({
        userId,
        action,
        entityType: 'VOUCHER_DETAILS',
        newValues: action === 'DELETE' ? null : {
          voucher_id: detail.voucher_id,
          voucher_number: voucherInfo?.voucher_number,
          voucher_type: voucherInfo?.voucher_type,
          account_code: detail.account_code,
          entry_type: detail.entry_type,
          amount: detail.amount,
          quantity: detail.quantity,
          partner_id: detail.partner_id,
          item_id: detail.item_id
        },
        oldValues: action === 'DELETE' ? {
          voucher_id: detail.voucher_id,
          voucher_number: voucherInfo?.voucher_number,
          voucher_type: voucherInfo?.voucher_type,
          account_code: detail.account_code,
          entry_type: detail.entry_type,
          amount: detail.amount,
          quantity: detail.quantity,
          partner_id: detail.partner_id,
          item_id: detail.item_id
        } : null,
        ipAddress,
        companyId
      });
    }
  } catch (error) {
    console.error('Lỗi ghi voucher details log:', error.message);
  }
}
