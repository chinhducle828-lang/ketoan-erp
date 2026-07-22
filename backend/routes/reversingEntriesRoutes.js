/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, checkCompanyAccess, requireRole } from '../middleware/auth.js';
import {
  createReversingEntries,
  getReversingEntries,
  checkReversingEntriesExist
} from '../services/reversingEntries.service.js';

const router = express.Router();

/**
 * @route   POST /api/reversing-entries
 * @desc    Tạo bút toán hoàn nhập đầu năm
 * @access  Private (admin, ktt)
 */
router.post('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { company_id, year } = req.body;
    
    if (!company_id || !year) {
      return res.status(400).json({ error: 'company_id và year là bắt buộc' });
    }
    
    const result = await createReversingEntries(company_id, year, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/reversing-entries
 * @desc    Lấy danh sách bút toán hoàn nhập
 * @access  Private
 */
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = parseInt(req.query.company_id, 10);
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    
    const result = await getReversingEntries(companyId, year);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   GET /api/reversing-entries/check
 * @desc    Kiểm tra xem năm đã hoàn nhập chưa
 * @access  Private
 */
router.get('/check', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = parseInt(req.query.company_id, 10);
    const year = parseInt(req.query.year, 10);
    
    if (!companyId || !year) {
      return res.status(400).json({ error: 'company_id và year là bắt buộc' });
    }
    
    const result = await checkReversingEntriesExist(companyId, year);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;