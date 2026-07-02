import express from 'express';
import { createPartner, getPartners } from '../controllers/partnerController.js';
import { validatePartner } from '../validators/partnerValidator.js';
import { authenticate, checkCompanyAccess } from '../middleware/auth.js'; // 👈 Thêm checkCompanyAccess vào đây

const router = express.Router();

// 1. API Thêm mới đối tác (Gài thêm checkCompanyAccess)
router.post('/create', authenticate, checkCompanyAccess, validatePartner, createPartner);

// 2. API Lấy danh sách đối tác (Gài thêm checkCompanyAccess)
router.get('/list', authenticate, checkCompanyAccess, getPartners);

export { router as partnerRouter };