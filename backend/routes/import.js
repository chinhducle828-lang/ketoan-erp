/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';
// BỔ SUNG LOGIC: Cơ chế dọn RAM cache hệ thống kế toán nội bộ
import { invalidateCompanyCache } from '../controllers/erpController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/vouchers', authenticate, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.body.companyId || req.query.company_id;
    if (!companyId) return res.status(400).json({ error: 'Thiếu mã đơn vị doanh nghiệp!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, companyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền nạp dữ liệu vào đơn vị này!' });
    }

    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn tệp Excel chứng từ!' });

    await client.query('BEGIN');
    let successCount = 0;
    
    // ... Logic đọc ghi dữ liệu Excel từ file của bạn ...

    await client.query('COMMIT');

    // ĐỒNG BỘ CACHE ĐA TẦNG:
    await invalidateCache(`dashboard:cashflow:${companyId}:*`); // Xóa cache Redis dòng tiền
    invalidateCompanyCache(companyId);                            // Xóa RAM Cache kết xuất sổ cái

    res.json({ success: true, message: `Nhập chứng từ thành công!` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router; // Đảm bảo Default Export để khớp với server.js
export { router as importRouter };