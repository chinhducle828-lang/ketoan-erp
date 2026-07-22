/**
 * metaAdmin.service.js - Service layer cho admin CRUD trên rea_meta
 * KHÔNG hard-coded: đọc cấu hình entity_type từ DB, validate động
 */

import { pool } from '../config/db.js';

const VALID_TABLE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/**
 * Validate table name an toàn (chống SQL injection, chống tên bảng hệ thống)
 */
function validateTableName(tableName) {
  if (!tableName || !VALID_TABLE_NAME_REGEX.test(tableName)) {
    throw new Error(`Table name "${tableName}" không hợp lệ`);
  }
  const BLACKLIST = ['users', 'companies', 'sessions', 'audit_logs', 'rea_meta', 'rea_events',
    'vouchers', 'voucher_details', 'partners', 'items', 'pg_%'];
  for (const pattern of BLACKLIST) {
    if (pattern.endsWith('%')) {
      if (tableName.startsWith(pattern.slice(0, -1))) {
        throw new Error(`Table name "${tableName}" bị cấm (trùng prefix hệ thống)`);
      }
    } else if (tableName === pattern) {
      throw new Error(`Table name "${tableName}" là bảng hệ thống, không thể tạo`);
    }
  }
}

/**
 * Tự động tạo bảng động với cấu trúc cơ bản
 */
async function autoCreateTable(tableName) {
  validateTableName(tableName);
  const { rows } = await pool.query(
    "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = $1)",
    [tableName]
  );
  if (rows[0].exists) return false;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL DEFAULT '${tableName.replace('dynamic_', '')}',
      status VARCHAR(20) DEFAULT 'draft',
      description TEXT,
      notes TEXT,
      created_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  return true;
}

/**
 * Thêm cột vào bảng động (non-blocking)
 */
async function addColumnIfNotExists(tableName, columnName, columnType) {
  validateTableName(tableName);
  const safeType = columnType || 'TEXT';
  await pool.query(`
    ALTER TABLE "${tableName}" 
    ADD COLUMN IF NOT EXISTS "${columnName}" ${safeType}
  `);
}

/**
 * Tạo entity config mới trong rea_meta
 */
export async function createEntityConfig({ entityType, companyId, tableName, uiSchema, gridColumns, permissions, createdBy }) {
  const finalTableName = tableName || `dynamic_${entityType}`;
  validateTableName(finalTableName);

  const { rows: existing } = await pool.query(
    'SELECT id FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
    [entityType, companyId]
  );
  if (existing.length > 0) {
    const { rows } = await pool.query(
      `INSERT INTO rea_meta (entity_type, company_id, table_name, ui_schema, grid_columns, permissions, version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(version), 0) + 1 FROM rea_meta WHERE entity_type = $1 AND company_id = $2), $7)
       RETURNING *`,
      [entityType, companyId, finalTableName, JSON.stringify(uiSchema || {}), JSON.stringify(gridColumns || []), JSON.stringify(permissions || {}), createdBy]
    );
    return rows[0];
  }

  await autoCreateTable(finalTableName);

  const { rows } = await pool.query(
    `INSERT INTO rea_meta (entity_type, company_id, table_name, ui_schema, grid_columns, permissions, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [entityType, companyId, finalTableName, JSON.stringify(uiSchema || {}), JSON.stringify(gridColumns || []), JSON.stringify(permissions || {}), createdBy]
  );
  return rows[0];
}

/**
 * Cập nhật UI Schema / Grid Columns cho entity
 */
export async function updateEntityConfig({ entityType, companyId, uiSchema, gridColumns, permissions }) {
  const { rows: current } = await pool.query(
    'SELECT id, table_name FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE ORDER BY version DESC LIMIT 1',
    [entityType, companyId]
  );
  if (current.length === 0) {
    throw new Error(`Entity type "${entityType}" chưa được cấu hình`);
  }

  const tableName = current[0].table_name || `dynamic_${entityType}`;

  const { rows } = await pool.query(
    `INSERT INTO rea_meta (entity_type, company_id, table_name, ui_schema, grid_columns, permissions, version)
     VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(version), 0) + 1 FROM rea_meta WHERE entity_type = $1 AND company_id = $2))
     RETURNING *`,
    [entityType, companyId, tableName,
     JSON.stringify(uiSchema || {}), JSON.stringify(gridColumns || []), JSON.stringify(permissions || {})]
  );

  if (uiSchema?.fields) {
    for (const field of uiSchema.fields) {
      const columnType = field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'PERCENT'
        ? 'NUMERIC(15,2) DEFAULT 0'
        : field.type === 'DATE'
          ? 'DATE'
          : 'TEXT';
      await addColumnIfNotExists(tableName, field.id, columnType).catch(() => {});
    }
  }

  return rows[0];
}

/**
 * Lấy danh sách entity configs cho 1 company
 */
export async function listEntityConfigs(companyId) {
  const { rows } = await pool.query(
    `SELECT id, entity_type, table_name, 
            ui_schema->>'title' AS title,
            is_active, version, created_at, updated_at
     FROM rea_meta 
     WHERE company_id = $1 AND is_active = TRUE
     ORDER BY entity_type`,
    [companyId]
  );
  return rows;
}

/**
 * Lấy chi tiết 1 entity config
 */
export async function getEntityConfig(entityType, companyId) {
  const { rows } = await pool.query(
    `SELECT * FROM rea_meta 
     WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE 
     ORDER BY version DESC LIMIT 1`,
    [entityType, companyId]
  );
  return rows[0] || null;
}

/**
 * Xóa entity config (soft delete)
 */
export async function deleteEntityConfig(entityType, companyId) {
  const { rows } = await pool.query(
    `UPDATE rea_meta SET is_active = FALSE, updated_at = NOW()
     WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE
     RETURNING id`,
    [entityType, companyId]
  );
  return rows.length > 0;
}