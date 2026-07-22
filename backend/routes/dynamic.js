/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/dynamic.js - Generic CRUD API cho Dynamic Entity
 * Tự động xử lý các entity type được định nghĩa trong rea_meta
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { getEventProcessor } from '../core/rea/reaEventMapper.js';
import { safeCall } from '../core/rea/reaEventMapper.js';

const router = Router();

/**
 * GET /api/dynamic/:entityType
 * Lấy danh sách records cho entity type
 * Query params: ?limit=50&offset=0&company_id=1
 */
router.get('/:entityType', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const entityType = req.params.entityType;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate entity type exists in rea_meta
    const { rows: metaRows } = await pool.query(
      'SELECT table_name FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
      [entityType, companyId]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Entity type "${entityType}" không tồn tại hoặc chưa được cấu hình` 
      });
    }

    const tableName = metaRows[0].table_name || `dynamic_${entityType}`;

    // Check if table exists
    const { rows: tableRows } = await pool.query(
      "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = $1)",
      [tableName]
    );

    if (!tableRows[0].exists) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: `Bảng ${tableName} chưa được tạo`
      });
    }

    // Build dynamic query with search
    let query = `SELECT * FROM "${tableName}" WHERE company_id = $1`;
    const params = [companyId];
    let paramCount = 1;

    // Search: tìm kiếm LIKE trên tất cả các cột TEXT
    if (req.query.search) {
      const searchTerm = `%${req.query.search}%`;
      // Lấy danh sách cột text từ bảng
      const { rows: colRows } = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
          AND (data_type LIKE 'text%' OR data_type LIKE 'char%' OR data_type = 'numeric' OR data_type = 'varchar')
      `, [tableName]);
      
      if (colRows.length > 0) {
        paramCount++;
        const searchClauses = colRows.map(col => {
          if (col.data_type === 'numeric') {
            return `CAST("${col.column_name}" AS TEXT) ILIKE $${paramCount}`;
          }
          return `"${col.column_name}"::TEXT ILIKE $${paramCount}`;
        });
        query += ` AND (${searchClauses.join(' OR ')})`;
        params.push(searchTerm);
      }
    }

    // Add filters from query params (non-standard params)
    Object.keys(req.query).forEach(key => {
      if (!['limit', 'offset', 'company_id', 'entityType', 'search'].includes(key)) {
        paramCount++;
        query += ` AND "${key}" = $${paramCount}`;
        params.push(req.query[key]);
      }
    });

    // Get total count
    const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) FROM');
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = parseInt(countRows[0].count);

    // Add pagination
    paramCount++;
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const { rows } = await pool.query(query, params);

    // Export CSV format if requested
    if (req.query.format === 'csv') {
      const { rows: colMeta } = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      const headers = colMeta.map(c => c.column_name);
      let csv = '\uFEFF' + headers.join(',') + '\n';
      rows.forEach(row => {
        csv += headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',') + '\n';
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: rows,
      total,
      limit,
      offset
    });
  } catch (err) {
    console.error(`❌ Lỗi lấy danh sách ${req.params.entityType}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dynamic/:entityType/:id
 * Lấy chi tiết 1 record
 */
router.get('/:entityType/:id', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const { entityType, id } = req.params;

    const { rows: metaRows } = await pool.query(
      'SELECT table_name FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
      [entityType, companyId]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Entity type "${entityType}" không tồn tại` 
      });
    }

    const tableName = metaRows[0].table_name || `dynamic_${entityType}`;

    const { rows } = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy record' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(`❌ Lỗi lấy chi tiết ${req.params.entityType}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/dynamic/:entityType
 * Tạo record mới
 */
router.post('/:entityType', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    const entityType = req.params.entityType;

    const { rows: metaRows } = await pool.query(
      'SELECT table_name, accounting_template FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
      [entityType, companyId]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Entity type "${entityType}" không tồn tại` 
      });
    }

    const tableName = metaRows[0].table_name || `dynamic_${entityType}`;
    const accountingTemplate = metaRows[0].accounting_template;

    // Build dynamic INSERT query
    const fields = Object.keys(req.body).filter(key => key !== 'company_id');
    const values = fields.map(key => req.body[key]);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');

    const query = `
      INSERT INTO ${tableName} (company_id, ${fields.join(', ')})
      VALUES ($1, ${placeholders})
      RETURNING *
    `;

    const { rows } = await pool.query(query, [companyId, ...values]);

    // If accounting template exists, generate accounting entries
    if (accountingTemplate && req.body._generate_entries) {
      try {
        const processor = getEventProcessor(entityType);
        if (processor && processor.generateEntries) {
          const entries = safeCall(processor.generateEntries, req.body) || [];
          // TODO: Save accounting entries to voucher_details
          console.log(`[Dynamic] Generated ${entries.length} accounting entries for ${entityType}`);
        }
      } catch (err) {
        console.warn(`[Dynamic] Failed to generate entries:`, err.message);
      }
    }

    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Tạo mới thành công'
    });
  } catch (err) {
    console.error(`❌ Lỗi tạo ${req.params.entityType}:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/dynamic/:entityType/:id
 * Cập nhật record
 */
router.put('/:entityType/:id', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    const { entityType, id } = req.params;

    const { rows: metaRows } = await pool.query(
      'SELECT table_name FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
      [entityType, companyId]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Entity type "${entityType}" không tồn tại` 
      });
    }

    const tableName = metaRows[0].table_name || `dynamic_${entityType}`;

    // Build dynamic UPDATE query
    const fields = Object.keys(req.body).filter(key => key !== 'company_id' && key !== 'id');
    const setClause = fields.map((key, i) => `${key} = $${i + 3}`).join(', ');
    
    const query = `
      UPDATE ${tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `;

    const values = fields.map(key => req.body[key]);
    const { rows } = await pool.query(query, [id, companyId, ...values]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy record' });
    }

    res.json({
      success: true,
      data: rows[0],
      message: 'Cập nhật thành công'
    });
  } catch (err) {
    console.error(`❌ Lỗi cập nhật ${req.params.entityType}:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/dynamic/:entityType/:id
 * Xóa record
 */
router.delete('/:entityType/:id', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const { entityType, id } = req.params;

    const { rows: metaRows } = await pool.query(
      'SELECT table_name FROM rea_meta WHERE entity_type = $1 AND company_id = $2 AND is_active = TRUE',
      [entityType, companyId]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Entity type "${entityType}" không tồn tại` 
      });
    }

    const tableName = metaRows[0].table_name || `dynamic_${entityType}`;

    const { rows } = await pool.query(
      `DELETE FROM ${tableName} WHERE id = $1 AND company_id = $2 RETURNING id`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy record' });
    }

    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    console.error(`❌ Lỗi xóa ${req.params.entityType}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;