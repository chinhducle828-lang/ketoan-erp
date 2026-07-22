/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * metaApi.service.js - Gen UI Schema từ businessRules + rea_meta
 * Dùng cho Server-Driven UI (SDUI)
 */

import { pool } from '../config/db.js';
import { getUISchemaConfig } from '../config/businessRules.js';

/**
 * Lấy UI Schema cho 1 entity type
 * Ưu tiên custom schema từ rea_meta, fallback về default từ businessRules
 * @param {string} entityType - Loại nghiệp vụ ('factoring', 'sale', 'intercompany')
 * @param {number} companyId - ID công ty
 * @returns {Object|null} UI Schema hoặc null
 */
export async function getUISchema(entityType, companyId) {
  // 1. Kiểm tra rea_meta có custom schema không
  const { rows } = await pool.query(
    `SELECT ui_schema FROM rea_meta 
     WHERE company_id = $1 AND entity_type = $2 AND is_active = TRUE 
     ORDER BY version DESC LIMIT 1`,
    [companyId, entityType]
  );

  // Debug logging
  console.log(`[metaApi] getUISchema: entityType=${entityType}, companyId=${companyId}, rows=${rows.length}`);
  if (rows.length > 0) {
    console.log(`[metaApi] ui_schema type: ${typeof rows[0].ui_schema}`);
    console.log(`[metaApi] ui_schema keys: ${rows[0].ui_schema ? Object.keys(rows[0].ui_schema).join(', ') : 'null'}`);
  }

  if (rows.length > 0 && rows[0].ui_schema?.fields?.length > 0) {
    return rows[0].ui_schema;
  }

  // 2. Fallback về default từ businessRules
  const config = getUISchemaConfig();
  return config.rea_subtypes[entityType] || null;
}

/**
 * Lấy grid columns cho 1 entity type
 * @param {string} entityType - Loại nghiệp vụ
 * @param {number} companyId - ID công ty
 * @returns {Array} Mảng cấu hình cột
 */
export async function getGridColumns(entityType, companyId) {
  // 1. Kiểm tra rea_meta có custom columns không
  const { rows } = await pool.query(
    `SELECT grid_columns FROM rea_meta 
     WHERE company_id = $1 AND entity_type = $2 AND is_active = TRUE 
     ORDER BY version DESC LIMIT 1`,
    [companyId, entityType]
  );

  if (rows.length > 0 && rows[0].grid_columns?.length > 0) {
    return rows[0].grid_columns;
  }

  // 2. Default columns
  return [
    { key: 'id', title: 'Mã', sortable: true, width: 80 },
    { key: 'voucher_number', title: 'Số CT', sortable: true },
    { key: 'voucher_date', title: 'Ngày', type: 'DATE', sortable: true },
    { key: 'description', title: 'Diễn giải' },
    { key: 'total_amount', title: 'Số tiền', type: 'CURRENCY', sortable: true }
  ];
}