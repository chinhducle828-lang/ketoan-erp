/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * @deprecated DEPRECATED - Multi-tenant architecture đã thay đổi
 * 
 * ⚠️  LƯU Ý QUAN TRỌNG CHO DEVELOPERS:
 * 
 * Architecture cũ (schema-per-tenant) ĐÃ BỎ:
 * - Không còn tạo schema riêng cho mỗi company (company_1, company_2, ...)
 * - Không còn dùng getTenantDb() với schema parameter
 * - Không còn dùng tenantMiddleware trong routes
 * 
 * Architecture mới (row-level security):
 * - TẤT CẢ companies dùng chung 1 schema "public"
 * - Mọi table có cột company_id để phân biệt data
 * - Isolation thông qua company_id + RLS (Row Level Security)
 * - Middleware: checkCompanyAccess (đặt req.companyId)
 * 
 * @see backend/middleware/auth.js - checkCompanyAccess middleware
 * @see backend/cache/redisMultiTenancy.js - Redis isolation
 * @see backend/migrations/ - company_id columns on all tables
 */

// ====================================================================
// DEPRECATED FUNCTIONS - CHỈ DÙNG CHO LEGACY CODE
// ====================================================================

/**
 * @deprecated Use checkCompanyAccess middleware instead
 * @see backend/middleware/auth.js
 */
export const tenantMiddleware = async (req, res, next) => {
  console.warn('[DEPRECATED] tenantMiddleware is deprecated. Use checkCompanyAccess from auth.js');
  
  // Fallback: Lấy companyId từ query/header
  const companyId = req.headers['x-company-id'] || req.query.company_id;
  
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }
  
  // Attach to request for backward compatibility
  req.companyId = companyId;
  req.tenant = { companyId, schema: 'public' };
  
  next();
};

/**
 * @deprecated Không còn dùng schema-per-tenant
 * @see Multi-tenant architecture đã chuyển sang row-level security
 */
export const createTenantConfig = (companyId) => {
  console.warn('[DEPRECATED] createTenantConfig is deprecated. All tenants use public schema with company_id isolation.');
  
  return {
    schema: 'public', // TẤT CẢ dùng public schema
    companyId,
    redis: {
      keyPrefix: `company_${companyId}:` // Redis prefix theo company
    }
  };
};

/**
 * @deprecated Không còn tạo schema riêng cho mỗi tenant
 * @see Tables đã có company_id column từ đầu
 */
export const createTenantSchema = async (companyId) => {
  console.warn('[DEPRECATED] createTenantSchema is deprecated. Schema-per-tenant architecture is no longer used.');
  
  // Không làm gì cả - chỉ log warning
  return 'public';
};

/**
 * @deprecated Use req.companyId from checkCompanyAccess middleware
 * @see backend/middleware/auth.js
 */
export const getTenantById = async (companyId) => {
  console.warn('[DEPRECATED] getTenantById is deprecated. Use req.companyId from middleware.');
  
  return {
    companyId,
    schema: 'public',
    db: null // Không còn tenant-specific db connection
  };
};

// ====================================================================
// MIGRATION GUIDE (cho developers)
// ====================================================================
/**
 * MIGRATION FROM OLD TO NEW ARCHITECTURE:
 * 
 * ❌ OLD (schema-per-tenant):
 *    import { tenantMiddleware } from '../config/tenant.js';
 *    router.get('/data', tenantMiddleware, async (req, res) => {
 *      const db = req.tenantDb; // Tenant-specific connection
 *      const result = await db.query('SELECT * FROM vouchers');
 *    });
 * 
 * ✅ NEW (row-level security):
 *    import { checkCompanyAccess } from '../middleware/auth.js';
 *    router.get('/data', authenticate, checkCompanyAccess, async (req, res) => {
 *      const companyId = req.companyId; // From middleware
 *      const result = await pool.query(
 *        'SELECT * FROM vouchers WHERE company_id = $1',
 *        [companyId]
 *      });
 *    });
 * 
 * KEY CHANGES:
 * 1. Replace tenantMiddleware → checkCompanyAccess + authenticate
 * 2. Replace req.tenantDb → pool (shared connection)
 * 3. Add WHERE company_id = $1 to all queries
 * 4. Remove schema parameter from all db calls
 * 5. Use req.companyId instead of req.tenant.companyId
 */