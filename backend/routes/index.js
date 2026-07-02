import express from 'express';

// ==========================================
// 1. IMPORT TOÀN BỘ ROUTES CỦA HỆ THỐNG
// ==========================================

// Nhóm Hệ thống & Danh mục
import authRoutes from './auth.js';
import userRoutes from './users.js';
import companyRoutes from './companies.js';
import partnerRoutes from './partnerRoute.js';
import itemRoutes from './items.js';
import dashboardRoutes from './dashboard.js';

// Nhóm Nghiệp vụ Kế toán (Áp dụng TT 99)
import openingBalanceRoutes from './openingBalances.js';
import voucherRoutes from './vouchers.js';
import cashRoutes from './cash.routes.js';
import salesRoutes from './sales.routes.js';
import purchasingRoutes from './purchasing.routes.js';
import hrRoutes from './hr.routes.js';
import closingRoutes from './closing.routes.js';

// Nhóm Quản lý Kho bãi
import importRoutes from './import.js';
import exportRoutes from './export.js';
import inventoryRoutes from './inventoryRoutes.js';

const router = express.Router();

// ==========================================
// 2. GẮN ROUTES VÀO ENDPOINT
// ==========================================
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/companies', companyRoutes);
router.use('/partners', partnerRoutes);
router.use('/items', itemRoutes);
router.use('/dashboard', dashboardRoutes);

router.use('/opening-balances', openingBalanceRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/cash', cashRoutes);
router.use('/sales', salesRoutes);
router.use('/purchasing', purchasingRoutes);
router.use('/hr', hrRoutes);
router.use('/closing', closingRoutes);

router.use('/import', importRoutes);
router.use('/export', exportRoutes);
router.use('/inventory', inventoryRoutes);

export default router;