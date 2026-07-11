/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
// Nạp 2 hàm từ controller xử lý thuật toán dồn tích và giá vốn kho
import { runInventoryCosting, getLedgerBalances, getAuditLogs } from '../controllers/erpController.js';
import { getStockLevels } from '../controllers/inventoryController.js';
import { authenticate, checkCompanyAccess, requireRootAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/inventory/costing
 * @desc    Kích hoạt máy chủ chạy tính toán áp giá xuất kho bình quân cuối kỳ O(N)
 * @access  Private (Đăng nhập & Thuộc về Doanh nghiệp đó)
 */
router.post('/costing', authenticate, checkCompanyAccess, runInventoryCosting);

/**
 * @route   GET /api/inventory/balances
 * @desc    Lấy bảng cân đối số dư tài khoản tổng hợp động (RAM Cache < 2ms cho 13 phân hệ)
 * @access  Private (Đăng nhập & Thuộc về Doanh nghiệp đó)
 */
router.get('/balances', authenticate, checkCompanyAccess, getLedgerBalances);

/**
 * @route   GET /api/inventory/audit-logs
 * @desc    Lấy danh sách nhật ký hệ thống (CHỈ ROOT ADMIN - username='admin')
 * @access  Private (Root Admin only)
 */
router.get('/audit-logs', authenticate, requireRootAdmin, getAuditLogs);

/**
 * @route   GET /api/inventory/stock-levels
 * @desc    Lấy tồn kho thực tế theo mã hàng (đã tính nhập/xuất)
 * @access  Private
 */
router.get('/stock-levels', authenticate, checkCompanyAccess, getStockLevels);

export default router;
