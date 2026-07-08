/**
 * Legal Public Routes
 * 
 * Công khai thông tin doanh nghiệp, tiếp nhận khiếu nại,
 * phục vụ nội dung tài liệu pháp lý công khai.
 * - NĐ 248/2026/NĐ-CP Điều 4, 14, 15
 * - Luật BV dữ liệu cá nhân 2025 (91/2025/QH15)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { logAction, getClientIp } from '../services/auditLog.service.js';
import { getBusinessRules } from '../config/businessRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEGAL_DOCS_DIR = path.join(__dirname, '..', 'docs', 'legal');

const router = express.Router();

/**
 * Danh sách tài liệu pháp lý công khai
 */
const PUBLIC_DOCUMENTS = [
  { type: 'CHINH_SACH_BAO_MAT', title: 'Chính sách bảo mật thông tin khách hàng', group: 'public' },
  { type: 'DIEU_KHOAN_SU_DUNG', title: 'Điều khoản sử dụng dịch vụ', group: 'public' },
  { type: 'QUY_TRINH_THANH_TOAN', title: 'Quy trình thanh toán', group: 'public' },
  { type: 'CHINH_SACH_HOAN_TIEN_HUY_GOI', title: 'Chính sách hoàn tiền & hủy gói', group: 'public' },
];

const DOCUMENT_VERSION_MAP = {
  CHINH_SACH_BAO_MAT: () => getBusinessRules().legal?.privacyPolicyVersion || '2.0',
  DIEU_KHOAN_SU_DUNG: () => getBusinessRules().legal?.termsVersion || '2.0',
  QUY_TRINH_THANH_TOAN: () => getBusinessRules().legal?.paymentProceduresVersion || '2.0',
  CHINH_SACH_HOAN_TIEN_HUY_GOI: () => getBusinessRules().legal?.refundPolicyVersion || '2.0',
};

/**
 * Công khai thông tin doanh nghiệp (NĐ 248/2026 Đ4)
 * Không cần đăng nhập
 */
router.get('/business-info', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const companyRes = await pool.query(
      'SELECT id, name, tax_code, address, lock_date, created_at FROM companies WHERE id = $1 LIMIT 1',
      [companyId]
    );
    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy doanh nghiệp' });
    }

    const company = companyRes.rows[0];

    const profileRes = await pool.query(
      'SELECT legal_name, email, hotline, website, license_no, dpo_name, dpo_email, data_retention_days FROM company_profiles WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    const profile = profileRes.rows[0] || {};

    res.json({
      success: true,
      data: {
        ...company,
        ...profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Tiếp nhận khiếu nại trực tuyến (NĐ 248/2026)
 * Công khai, có rate-limit
 */
router.post('/complaints', rateLimiter, async (req, res) => {
  try {
    const { company_id, name, email, content } = req.body;
    if (!company_id || !name || !content) {
      return res.status(400).json({ error: 'Thiếu thông tin khiếu nại' });
    }

    const result = await pool.query(
      `INSERT INTO complaints (company_id, name, email, content, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [company_id, name, email || null, content]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Lấy danh sách tài liệu pháp lý công khai
 * GET /api/public/legal/documents
 */
router.get('/documents', async (req, res) => {
  try {
    const docs = PUBLIC_DOCUMENTS.map((doc) => ({
      type: doc.type,
      title: doc.title,
      group: doc.group,
      version: DOCUMENT_VERSION_MAP[doc.type]?.() || '1.0',
      updatedAt: getDocumentUpdatedAt(doc.type)
    }));

    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Lấy nội dung một tài liệu pháp lý
 * GET /api/public/legal/documents/:type
 */
router.get('/documents/:type', async (req, res) => {
  try {
    const docType = String(req.params.type || '').trim().replace(/\.\./g, '').replace(/[/\\]/g, '');
    if (!docType) {
      return res.status(400).json({ error: 'Thiếu loại tài liệu' });
    }

    const docMeta = PUBLIC_DOCUMENTS.find((d) => d.type === docType);
    if (!docMeta) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }

    const docPath = path.join(LEGAL_DOCS_DIR, `${docType}.md`);
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ error: 'File tài liệu không tồn tại' });
    }

    const content = fs.readFileSync(docPath, 'utf8');
    const version = DOCUMENT_VERSION_MAP[docType]?.() || '1.0';

    res.json({
      success: true,
      data: {
        type: docType,
        title: docMeta.title,
        version,
        content,
        updatedAt: getDocumentUpdatedAt(docType)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Lấy thông tin liên hệ DPO
 * GET /api/public/legal/dpo
 */
router.get('/dpo', async (req, res) => {
  try {
    const rules = getBusinessRules().legal || {};
    res.json({
      success: true,
      data: {
        dpoName: rules.dpoName || '[TÊN DPO]',
        dpoEmail: rules.dpoEmail || '[EMAIL DPO]',
        dpoPhone: rules.dpoPhone || '[SỐ ĐIỆN THOẠI DPO]'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Lấy ngày cập nhật file
 */
function getDocumentUpdatedAt(docType) {
  try {
    const docPath = path.join(LEGAL_DOCS_DIR, `${docType}.md`);
    if (fs.existsSync(docPath)) {
      const stats = fs.statSync(docPath);
      return stats.mtime.toISOString();
    }
  } catch {
    // ignore
  }
  return null;
}

export { router as legalPublicRouter };
export default router;
