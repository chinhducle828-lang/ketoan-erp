/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
// Nạp 2 hàm từ controller xử lý thuật toán dồn tích và giá vốn kho
import { runInventoryCosting, getLedgerBalances, getAuditLogs } from '../controllers/erpController.js';
import { getStockLevels } from '../controllers/inventoryController.js';
import { authenticate, checkCompanyAccess, requireRootAdmin } from '../middleware/auth.js';
import {
  createStockReconciliation,
  approveStockReconciliation,
  cancelStockReconciliation,
  adjustReconciliationAccount,
  getStockReconciliations,
  getStockReconciliationDetails
} from '../services/stockReconciliation.service.js';

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

// ====================================================================
// STOCK RECONCILIATION - KIỂM KÊ KHO
// ====================================================================

/**
 * @route   POST /api/inventory/reconciliations
 * @desc    Tạo phiếu kiểm kê kho mới
 * @access  Private (admin, ktt)
 */
router.post('/reconciliations', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.body;
    const result = await createStockReconciliation(company_id, req.body, req.user?.id);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/inventory/reconciliations/:id/approve
 * @desc    Duyệt phiếu kiểm kê và sinh bút toán
 * @access  Private (admin, ktt)
 */
router.post('/reconciliations/:id/approve', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.body;
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await approveStockReconciliation(company_id, reconciliationId, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/inventory/reconciliations/:id/cancel
 * @desc    Hủy phiếu kiểm kê
 * @access  Private (admin, ktt)
 */
router.post('/reconciliations/:id/cancel', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.body;
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await cancelStockReconciliation(company_id, reconciliationId, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/inventory/reconciliations/:id/adjust
 * @desc    Điều chỉnh chênh lệch từ TK 1381 sang TK 711 hoặc 642
 * @access  Private (admin, ktt)
 */
router.post('/reconciliations/:id/adjust', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const { company_id, target_account, reason } = req.body;
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await adjustReconciliationAccount(company_id, reconciliationId, target_account, reason, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/inventory/reconciliations
 * @desc    Lấy danh sách phiếu kiểm kê
 * @access  Private
 */
router.get('/reconciliations', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = parseInt(req.query.company_id, 10);
    const filters = {
      status: req.query.status,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50
    };
    const result = await getStockReconciliations(companyId, filters);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/inventory/reconciliations/:id
 * @desc    Lấy chi tiết phiếu kiểm kê
 * @access  Private
 */
router.get('/reconciliations/:id', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await getStockReconciliationDetails(reconciliationId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
