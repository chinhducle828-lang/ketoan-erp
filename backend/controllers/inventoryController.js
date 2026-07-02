import { pool } from '../config/db.js';

/**
 * Lấy danh sách tồn kho hiện tại của doanh nghiệp
 */
export const getInventorySummary = async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) {
      return res.status(400).json({ error: 'Yêu cầu truyền tham số company_id!' });
    }

    // Truy vấn tổng lượng Nhập / Xuất chi tiết của từng vật tư hàng hóa trong kho
    const queryStr = `
      SELECT 
        i.id,
        i.code,
        i.name,
        i.unit,
        COALESCE(SUM(CASE WHEN doc.type = 'import' THEN d.quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN doc.type = 'export' THEN d.quantity ELSE 0 END), 0) as "onHand",
        COALESCE(AVG(CASE WHEN doc.type = 'import' THEN d.price ELSE NULL END), 0) as "avgCost"
      FROM items i
      LEFT JOIN (
        SELECT 'import' as type, item_id, quantity, price, company_id FROM warehouse_imports
        UNION ALL
        SELECT 'export' as type, item_id, quantity, price, company_id FROM warehouse_exports
      ) d ON i.id = d.item_id AND d.company_id = $1
      WHERE i.company_id = $1
      GROUP BY i.id, i.code, i.name, i.unit
      ORDER BY i.code ASC
    `;

    const result = await pool.query(queryStr, [company_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Trích xuất Sổ chi tiết Vật tư (Thẻ kho)
 */
export const getStockCard = async (req, res) => {
  try {
    const { company_id, item_id, from_date, to_date } = req.query;

    if (!company_id || !item_id) {
      return res.status(400).json({ error: 'Vui lòng cung cấp thông tin company_id và item_id!' });
    }

    const queryStr = `
      SELECT 
        'import' as direction,
        wi.import_date as "date",
        wi.voucher_no as "voucherNo",
        wi.quantity,
        wi.price,
        (wi.quantity * wi.price) as amount
      FROM warehouse_imports wi
      WHERE wi.company_id = $1 AND wi.item_id = $2 AND wi.import_date BETWEEN $3 AND $4
      
      UNION ALL
      
      SELECT 
        'export' as direction,
        we.export_date as "date",
        we.voucher_no as "voucherNo",
        we.quantity,
        we.price,
        (we.quantity * we.price) as amount
      FROM warehouse_exports we
      WHERE we.company_id = $1 AND we.item_id = $2 AND we.export_date BETWEEN $3 AND $4
      
      ORDER BY "date" ASC
    `;

    const result = await pool.query(queryStr, [company_id, item_id, from_date || '2026-01-01', to_date || '2026-12-31']);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};