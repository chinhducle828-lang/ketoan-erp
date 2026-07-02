import express from 'express';
import { createInventoryVoucher, getInventoryVouchers } from '../controllers/inventoryController.js';

const router = express.Router();

// Tuyến đường xử lý Tạo mới Phiếu Nhập / Xuất kho (Đa dòng)
// POST -> /api/inventory/vouchers
router.post('/vouchers', createInventoryVoucher);

// ✅ BỔ SUNG: Tuyến đường lấy danh sách Phiếu nhập / xuất kho (Có bộ lọc)
// GET -> /api/inventory/vouchers
router.get('/vouchers', getInventoryVouchers);

export default router;