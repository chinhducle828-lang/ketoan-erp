/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, checkCompanyAccess, requireRole } from '../middleware/auth.js';
import {
  createDebtReconciliation,
  approveDebtReconciliation,
  cancelDebtReconciliation,
  getDebtReconciliations,
  getDebtReconciliationDetails
} from '../services/debtReconciliation.service.js';

const router = express.Router();

/**
 * @route   POST /api/debt-reconciliations
 * @desc    Tạo biên bản cấn trừ công nợ
 * @access  Private (admin, ktt)
 */
router.post('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { company_id } = req.body;
    const result = await createDebtReconciliation(company_id, req.body, req.user?.id);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/debt-reconciliations/:id/approve
 * @desc    Duyệt biên bản cấn trừ và sinh bút toán
 * @access  Private (admin, ktt)
 */
router.post('/:id/approve', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { company_id } = req.body;
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await approveDebtReconciliation(company_id, reconciliationId, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/debt-reconciliations/:id/cancel
 * @desc    Hủy biên bản cấn trừ
 * @access  Private (admin, ktt)
 */
router.post('/:id/cancel', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { company_id } = req.body;
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await cancelDebtReconciliation(company_id, reconciliationId, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/debt-reconciliations
 * @desc    Lấy danh sách biên bản cấn trừ
 * @access  Private
 */
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = parseInt(req.query.company_id, 10);
    const filters = {
      type: req.query.type,
      status: req.query.status,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50
    };
    const result = await getDebtReconciliations(companyId, filters);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/debt-reconciliations/:id
 * @desc    Lấy chi tiết biên bản cấn trừ
 * @access  Private
 */
router.get('/:id', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const reconciliationId = parseInt(req.params.id, 10);
    const result = await getDebtReconciliationDetails(reconciliationId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;