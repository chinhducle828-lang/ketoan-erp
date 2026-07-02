import { pool } from '../config/db.js';

/**
 * @desc    Tạo mới Phiếu Nhập / Xuất kho (Hạch toán đa dòng - Master Detail)
 * @route   POST /api/inventory/vouchers
 * @access  Private
 */
/**
 * Lấy danh sách Phiếu nhập / xuất kho (Có bộ lọc theo công ty, loại phiếu)
 * GET -> /api/inventory/vouchers
 */
export const getInventoryVouchers = async (req, res) => {
  try {
    // Trong thực tế, company_id nên lấy từ token bảo mật của user đã đăng nhập (req.user.company_id)
    const { company_id, io_type } = req.query;

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin ID công ty!' });
    }

    let query = `
      SELECT iv.*, p.partner_name, u.username as creator_name
      FROM inventory_vouchers iv
      LEFT JOIN partners p ON iv.partner_id = p.id
      LEFT JOIN users u ON iv.created_by = u.id
      WHERE iv.company_id = $1
    `;
    
    const values = [company_id];

    // Lọc theo loại Nhập (IMPORT) hoặc Xuất (EXPORT) nếu có truyền lên
    if (io_type) {
      query += ` AND iv.io_type = $2`;
      values.push(io_type);
    }

    query += ` ORDER BY iv.voucher_date DESC, iv.created_at DESC`;

    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách phiếu kho:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
  }
};
export const createInventoryVoucher = async (req, res) => {
  // Lấy kết nối client từ pool để chạy Transaction độc lập
  const client = await pool.connect();

  try {
    const {
      company_id,
      voucher_number,
      voucher_date,
      io_type, // 'IMPORT' hoặc 'EXPORT'
      partner_id,
      description,
      created_by,
      details // Mảng chứa các dòng chi tiết vật tư
    } = req.body;

    // Kiểm tra tính hợp lệ cơ bản của dữ liệu chi tiết
    if (!details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({ success: false, message: 'Phiếu kho phải có ít nhất một dòng chi tiết vật tư!' });
    }

    // 1. Khởi động Transaction
    await client.query('BEGIN');

    // 2. Chèn dữ liệu vào bảng MASTER (inventory_vouchers)
    const masterQuery = `
      INSERT INTO inventory_vouchers (company_id, voucher_number, voucher_date, io_type, partner_id, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const masterValues = [company_id, voucher_number, voucher_date, io_type, partner_id, description, created_by];
    const masterResult = await client.query(masterQuery, masterValues);
    const inventory_voucher_id = masterResult.rows[0].id;

    // 3. Chèn đa dòng vào bảng DETAIL (inventory_voucher_details)
    const detailQuery = `
      INSERT INTO inventory_voucher_details (inventory_voucher_id, item_id, debit_account_code, credit_account_code, quantity, unit_price)
      VALUES ($1, $2, $3, $4, $5, $6);
    `;

    // Duyệt qua từng dòng vật tư người dùng gửi lên để insert tuần tự
    for (const row of details) {
      const { item_id, debit_account_code, credit_account_code, quantity, unit_price } = row;
      
      const detailValues = [
        inventory_voucher_id,
        item_id,
        debit_account_code,
        credit_account_code,
        quantity,
        unit_price || 0 // Nếu EXPORT chưa có giá thì mặc định là 0 để cuối kỳ tính sau
      ];

      await client.query(detailQuery, detailValues);
    }

    // 4. Nếu mọi thứ trơn tru, tiến hành COMMIT ghi dữ liệu vĩnh viễn vào DB
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Tạo phiếu ${io_type === 'IMPORT' ? 'nhập' : 'xuất'} kho thành công!`,
      voucher_id: inventory_voucher_id
    });

  } catch (error) {
    // 5. Nếu có BẤT KỲ lỗi nào xảy ra, lập tức ROLLBACK để khôi phục lại trạng thái ban đầu
    await client.query('ROLLBACK');
    console.error('LỖI TẠO PHIẾU KHO:', error);
    
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tạo phiếu kho!',
      error: error.message
    });
  } finally {
    // Luôn giải phóng kết nối trả lại cho pool
    client.release();
  }
};