/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { generateEInvoice, saveEInvoice, getEInvoiceById, listEInvoices } from '../services/einvoice.service.js';

const router = express.Router();

/**
 * Lấy chi tiết hóa đơn điện tử theo ID
 * Quyền: admin hoặc user thuộc công ty
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'ID hóa đơn không hợp lệ' });
    }

    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const hasAccess = await canAccessCompany(req.user, Number(companyId));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Không có quyền truy cập hóa đơn này' });
    }

    const invoice = await getEInvoiceById(invoiceId, Number(companyId));
    if (!invoice) {
      return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Lấy danh sách hóa đơn của công ty
 * Quyền: admin hoặc user thuộc công ty
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const hasAccess = await canAccessCompany(req.user, Number(companyId));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    const limit = parseInt(req.query.limit || '20', 10);
    const offset = parseInt(req.query.offset || '0', 10);

    const invoices = await listEInvoices(Number(companyId), { limit, offset });
    res.json({ success: true, data: invoices, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as einvoiceRouter };
export default router;