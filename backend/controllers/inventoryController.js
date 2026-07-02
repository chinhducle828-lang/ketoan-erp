import { pool } from '../config/db.js';

// Các tài khoản bị bãi bỏ theo Thông tư 99/2025/TT-BTC
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

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

/**
 * ✅ HÀM MỚI: Tạo mới Phiếu Nhập / Xuất kho (Đa dòng)
 * Tự động đồng bộ thẻ kho vật lý và ghi nhận bút toán Nợ-Có tài chính trong cùng một Transaction (ACID)
 */
export const createInventoryVoucher = async (req, res) => {
  const client = await pool.connect();
  try {
    const { 
      companyId, 
      type, // 'import' (nhập kho) hoặc 'export' (xuất kho)
      voucherDate, 
      voucherNo, 
      description, 
      details // mảng chứa: { itemId, quantity, price, accountCode, offsetAccountCode }
    } = req.body;

    if (!['import', 'export'].includes(type)) {
      return res.status(400).json({ error: 'Loại chứng từ kho không hợp lệ (Bắt buộc là import hoặc export)!' });
    }

    // 1. Kiểm soát khóa sổ kỳ kế toán tháng hạch toán
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2',
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán tháng ${period} đã khóa sổ. Không thể hạch toán thêm!` });
    }

    let totalAmount = 0;

    // 2. Kiểm duyệt tài khoản hạch toán theo chuẩn Thông tư 99
    for (const d of details) {
      const mainAcc = d.accountCode.substring(0, 4);
      const offsetAcc = d.offsetAccountCode.substring(0, 4);

      if (BANNED_ACCOUNTS_TT99.includes(mainAcc) || BANNED_ACCOUNTS_TT99.includes(offsetAcc)) {
        return res.status(400).json({ 
          error: `Tài khoản hạch toán ${d.accountCode} hoặc tài khoản đối ứng ${d.offsetAccountCode} đã bị bãi bỏ theo TT 99.` 
        });
      }
      totalAmount += Math.round(parseFloat(d.quantity) * parseFloat(d.price));
    }

    // 3. Thực hiện ACID Transaction đồng bộ hạch toán tài chính và thẻ kho vật lý
    await client.query('BEGIN');

    // Bước A: Ghi nhận chứng từ kế toán tổng hợp gốc
    const voucherType = type === 'import' ? 'NhapKho' : 'XuatKho';
    const insertVoucherQuery = `
      INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, created_by)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const voucherRes = await client.query(insertVoucherQuery, [
      companyId,
      voucherType,
      voucherDate,
      description || `${type === 'import' ? 'Nhập kho' : 'Xuất kho'} vật tư hàng hóa - Số phiếu: ${voucherNo}`,
      req.user.id
    ]);
    const voucherId = voucherRes.rows[0].id;

    // Bước B: Hạch toán đa dòng đối ứng Nợ - Có và Thẻ kho cho từng dòng hàng
    for (const d of details) {
      const itemAmount = Math.round(parseFloat(d.quantity) * parseFloat(d.price));

      // Hạch toán bút toán kép tài chính
      // Nhập kho: Nợ TK Kho (152/156) / Có TK Đối ứng (331,111...)
      // Xuất kho: Nợ TK Đối ứng (632,154...) / Có TK Kho (152/156)
      const debitAcc = type === 'import' ? d.accountCode : d.offsetAccountCode;
      const creditAcc = type === 'import' ? d.offsetAccountCode : d.accountCode;

      const insertDetailQuery = `
        INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
        VALUES ($1, $2, $3, $4)
      `;
      // Bút toán Ghi Nợ
      await client.query(insertDetailQuery, [voucherId, debitAcc, 'DR', itemAmount]);
      // Bút toán Ghi Có
      await client.query(insertDetailQuery, [voucherId, creditAcc, 'CR', itemAmount]);

      // Ghi thẻ kho vật lý vào bảng tương ứng để theo dõi lượng OnHand
      if (type === 'import') {
        const insertImportQuery = `
          INSERT INTO warehouse_imports (company_id, item_id, quantity, price, import_date, voucher_no)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(insertImportQuery, [companyId, d.itemId, d.quantity, d.price, voucherDate, voucherNo]);
      } else {
        const insertExportQuery = `
          INSERT INTO warehouse_exports (company_id, item_id, quantity, price, export_date, voucher_no)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(insertExportQuery, [companyId, d.itemId, d.quantity, d.price, voucherDate, voucherNo]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      success: true, 
      message: `Đã lập và duyệt thành công phiếu ${type === 'import' ? 'Nhập' : 'Xuất'} kho!` 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * ✅ HÀM MỚI: Truy vấn lịch sử danh sách Phiếu Nhập / Xuất kho (Có bộ lọc tìm kiếm)
 */
export const getInventoryVouchers = async (req, res) => {
  try {
    const { company_id, type, from_date, to_date } = req.query;
    
    if (!company_id) {
      return res.status(400).json({ error: 'Yêu cầu truyền tham số company_id!' });
    }

    let queryStr = `
      SELECT 
        id, 
        voucher_type as "type", 
        voucher_date as "voucherDate", 
        description
      FROM vouchers
      WHERE company_id = $1 AND voucher_type IN ('NhapKho', 'XuatKho')
    `;
    const params = [company_id];

    if (type) {
      queryStr += ` AND voucher_type = $2`;
      params.push(type === 'import' ? 'NhapKho' : 'XuatKho');
    }

    const dateParamIndex = params.length + 1;
    if (from_date && to_date) {
      queryStr += ` AND voucher_date BETWEEN $${dateParamIndex} AND $${dateParamIndex + 1}`;
      params.push(from_date, to_date);
    }

    queryStr += ' ORDER BY voucher_date DESC, id DESC LIMIT 100';

    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};