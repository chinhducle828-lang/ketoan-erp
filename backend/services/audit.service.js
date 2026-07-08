/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Audit Service
 * Ghi lại mọi thay đổi dữ liệu nhạy cảm
 */

import { pool } from '../config/db.js';

/**
 * Ghi audit log
 * @param {Object} params
 * @param {number} params.userId - ID người dùng
 * @param {string} params.action - Hành động (CREATE, UPDATE, DELETE)
 * @param {string} params.entityType - Loại thực thể (VOUCHERS, PARTNERS, ITEMS, etc.)
 * @param {Object} params.oldValues - Giá trị cũ
 * @param {Object} params.newValues - Giá trị mới
 * @param {string} params.ipAddress - Địa chỉ IP
 * @param {number} params.companyId - ID công ty (optional)
 */
export async function logAudit({
  userId,
  action,
  entityType,
  oldValues = null,
  newValues = null,
  ipAddress,
  companyId = null
}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, old_values, new_values, ip_address, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        entityType,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        companyId
      ]
    );
  } catch (err) {
    console.error('Lỗi ghi audit log:', err.message);
    // Không throw lỗi để không ảnh hưởng tới luồng chính
  }
}

/**
 * Lấy audit logs
 * @param {Object} options
 * @param {number} options.companyId - ID công ty
 * @param {string} options.entityType - Loại thực thể
 * @param {string} options.action - Hành động
 * @param {number} options.limit - Số bản ghi
 * @param {number} options.offset - Vị trí bắt đầu
 */
export async function getAuditLogs({
  companyId,
  entityType,
  action,
  limit = 100,
  offset = 0
}) {
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (companyId) {
    whereClause += ` AND company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }

  if (entityType) {
    whereClause += ` AND entity_type = $${paramIndex}`;
    params.push(entityType);
    paramIndex++;
  }

  if (action) {
    whereClause += ` AND action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }

  const query = `
    SELECT 
      id, user_id, action, entity_type, 
      old_values, new_values, ip_address, 
      created_at, company_id
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Lấy audit log theo ID
 * @param {number} id - ID audit log
 */
export async function getAuditLogById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM audit_logs WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Thống kê audit logs
 * @param {number} companyId - ID công ty
 */
export async function getAuditStats(companyId) {
  const { rows } = await pool.query(
    `SELECT 
      action, 
      entity_type, 
      COUNT(*) as count,
      MAX(created_at) as last_action
     FROM audit_logs 
     WHERE company_id = $1
     GROUP BY action, entity_type
     ORDER BY count DESC`,
    [companyId]
  );
  return rows;
}