/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: backend/controllers/erpController.js
import { calculateBalances } from '../utils/accountingEngine.js';
import { calculateWeightedAverageCost } from '../utils/inventoryEngine.js';
import { pool } from '../config/db.js';
import { getBalanceSheetData, getCustomerAccountBalances, getTaxAccountBalances } from '../services/report.service.js';
import { runClosingEntries } from '../services/closing.service.js';
import { assertCompanyOperational } from '../services/cascadeValidation.service.js';
import { invalidateCache } from '../cache/redis.js';

// Khởi tạo bộ lưu trữ Cache RAM cục bộ tốc độ cao cho ứng dụng
// WARNING: Cache này chỉ tồn tại trong memory của process hiện tại
// và KHÔNG tự động invalidation. Dữ liệu có thể bị stale.
// Cache sẽ tự động xóa sau 5 phút để tránh stale data.
const localCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
const cacheTimestamps = new Map(); // Theo dõi thời điểm cache được tạo

/**
 * API Lấy bảng cân đối số dư tài khoản động
 * Phục vụ đồng thời cho 13 phân hệ (Dòng tiền, Thuế GTGT, Giá thành,...)
 */
export const getLedgerBalances = async (req, res) => {
  try {
    // Ưu tiên lấy companyId từ middleware checkCompanyAccess đã xác thực, nếu không có mới lấy từ query
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }

    const cacheKey = `balances:${companyId}`;

    // 1. Kiểm tra lớp Cache bộ nhớ (Cache Hit) -> Trả kết quả ngay lập tức
    // Nếu cache đã hết hạn TTL thì xóa và tính lại từ DB
    if (localCache.has(cacheKey)) {
      const cachedAt = cacheTimestamps.get(cacheKey) || 0;
      if (Date.now() - cachedAt < CACHE_TTL_MS) {
        return res.json({ 
          success: true, 
          source: 'cache', 
          data: { accountLedger: localCache.get(cacheKey) } 
        });
      }
      // Cache đã hết hạn, xóa để tính lại
      localCache.delete(cacheKey);
      cacheTimestamps.delete(cacheKey);
    }

    // 2. Nếu chưa có trong Cache (Cache Miss) -> Kích hoạt Engine hạch toán dồn tích từ DB
    // Lấy tất cả chứng từ của công ty từ database
    const vouchersRes = await pool.query(`
      SELECT v.id, v.voucher_date, v.voucher_type, v.currency, v.exchange_rate, v.description,
             json_agg(json_build_object(
               'accountCode', vd.account_code,
               'entryType', vd.entry_type,
               'amount', vd.amount,
               'quantity', vd.quantity,
               'partnerId', vd.partner_id,
               'itemId', vd.item_id
             )) as details
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1
      GROUP BY v.id
    `, [Number(companyId)]);

    const balances = calculateBalances(vouchersRes.rows, []);
    
    // Lưu lại vào bộ nhớ đệm cho các lượt gọi sau
    localCache.set(cacheKey, balances);

    return res.json({ 
      success: true, 
      source: 'database', 
      data: { accountLedger: balances } 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Kích hoạt chạy thuật toán giá vốn kho vật tư tập trung
 */
export const runInventoryCosting = async (req, res) => {
  try {
    // Đồng bộ lấy companyId an toàn từ body hoặc middleware gán vào
    const companyId = req.companyId || req.body.companyId || req.body.company_id;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã định danh doanh nghiệp (companyId)!' });
    }

    await assertCompanyOperational(companyId);

    // 1. Kích hoạt Inventory Engine quét lượng, cập nhật đè số tiền 'amount' xuất kho xuống DB
    // Lấy tháng và năm từ body hoặc sử dụng tháng/năm hiện tại
    const month = req.body.month || new Date().getMonth() + 1;
    const year = req.body.year || new Date().getFullYear();
    
    const result = await calculateWeightedAverageCost(Number(companyId), month, year);
    
    // 2. GIẢI PHÓNG XUNG ĐỘT: Xóa sạch cache số dư cũ để Accounting Engine buộc phải tính lại
    const cacheKey = `balances:${companyId}`;
    localCache.delete(cacheKey);

    return res.json({
      success: true,
      message: 'Hệ thống đã chạy thuật toán giá vốn kho vật tư bình quân gia quyền thành công!',
      details: result
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Hàm hỗ trợ xuất khẩu (Middleware công khai)
 * Gọi từ các tệp router khác (như `vouchers.js`, `import.js`) để làm sạch cache 
 * mỗi khi người dùng thực hiện Thêm / Sửa / Xóa một chứng từ bất kỳ.
 */
export const invalidateCompanyCache = (companyId) => {
  const cacheKey = `balances:${Number(companyId)}`;
  if (localCache.has(cacheKey)) {
    localCache.delete(cacheKey);
  }
};

/**
 * API Lấy danh sách Audit Logs (Chỉ dành cho Admin)
 * Phân trang và lọc theo user_id, action, entity_type
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      user_id,
      action,
      entity_type,
      company_id,
      start_date,
      end_date
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Build WHERE clause dynamically
    const conditions = [];
    const params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      conditions.push(`al.user_id = $${paramCount}`);
      params.push(Number(user_id));
    }

    if (action) {
      paramCount++;
      conditions.push(`al.action = $${paramCount}`);
      params.push(action);
    }

    if (entity_type) {
      paramCount++;
      conditions.push(`al.entity_type = $${paramCount}`);
      params.push(entity_type);
    }

    if (company_id) {
      paramCount++;
      // Merge 2 cases: logs thuộc công ty đang chọn + logs toàn cục (company_id IS NULL),
      // để không bỏ sót LOGIN và các sự kiện hệ thống không gắn doanh nghiệp.
      conditions.push(`(al.company_id = $${paramCount} OR al.company_id IS NULL)`);
      params.push(Number(company_id));
    }

    if (start_date) {
      paramCount++;
      conditions.push(`al.created_at >= $${paramCount}`);
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      conditions.push(`al.created_at <= $${paramCount}`);
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get logs with user info
    paramCount++;
    const dataQuery = `
      SELECT 
        al.id,
        al.user_id,
        u.username,
        al.action,
        al.entity_type,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(Number(limit), offset);
    const dataResult = await pool.query(dataQuery, params);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi lấy audit logs:', error);
    res.status(500).json({ error: error.message });
  }
};
