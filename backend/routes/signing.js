/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Signing Routes - REST API endpoints for OTP digital signature
 * Tuân thủ Luật 108/2025/QH15
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  requestOtpForSigning,
  verifyAndSignDocument,
  getSigningStatus,
  cancelSigningRequest
} from '../services/signing.service.js';

const router = express.Router();

// 1. POST: Yêu cầu gửi OTP để ký số
router.post('/request-otp', authenticate, requireRole(['admin', 'ktt', 'nv']), async (req, res) => {
  try {
    const { voucherId, companyId, documentType } = req.body;
    
    if (!voucherId || !companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin voucherId hoặc companyId' });
    }

    const result = await requestOtpForSigning({
      userId: req.user.id,
      voucherId,
      companyId,
      documentType
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. POST: Xác thực OTP và ký số
router.post('/verify', authenticate, requireRole(['admin', 'ktt', 'nv']), async (req, res) => {
  try {
    const { voucherId, companyId, otp, documentType } = req.body;
    
    if (!voucherId || !companyId || !otp) {
      return res.status(400).json({ error: 'Thiếu thông tin voucherId, companyId hoặc otp' });
    }

    const result = await verifyAndSignDocument({
      userId: req.user.id,
      voucherId,
      companyId,
      otp,
      documentType
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. GET: Lấy trạng thái ký số của chứng từ
router.get('/status/:voucherId', authenticate, async (req, res) => {
  try {
    const { voucherId } = req.params;
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin companyId' });
    }

    const status = await getSigningStatus({ voucherId, companyId });
    
    if (!status) {
      return res.status(404).json({ error: 'Chứng từ không tồn tại' });
    }

    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. POST: Hủy yêu cầu ký số
router.post('/cancel', authenticate, requireRole(['admin', 'ktt', 'nv']), async (req, res) => {
  try {
    const { voucherId, companyId } = req.body;
    
    if (!voucherId || !companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin voucherId hoặc companyId' });
    }

    const result = await cancelSigningRequest({
      userId: req.user.id,
      voucherId,
      companyId
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;