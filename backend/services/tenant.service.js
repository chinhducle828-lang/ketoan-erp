/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { getTenantById, createTenantSchema } from '../config/tenant';
import redisClient from '../config/redis';

// Tenant service for multi-tenancy
class TenantService {
  constructor() {
    this.tenants = new Map();
  }

  // Get tenant configuration
  async getTenantConfig(companyId) {
    if (this.tenants.has(companyId)) {
      return this.tenants.get(companyId);
    }

    const tenant = await getTenantById(companyId);
    this.tenants.set(companyId, tenant);
    
    return tenant;
  }

  // Create new tenant
  async createTenant(companyId, companyName) {
    try {
      // Create schema
      const schema = await createTenantSchema(companyId);
      
      // Initialize default data
      const db = await this.getTenantConfig(companyId);
      
      // Create default accounts
      const defaultAccounts = [
        { code: '111', name: 'Tiền mặt', type: 'asset' },
        { code: '112', name: 'Tiền gửi ngân hàng', type: 'asset' },
        { code: '331', name: 'Doanh thu', type: 'revenue' },
        { code: '3331', name: 'Thuế GTGT phải nộp', type: 'liability' }
      ];

      for (const account of defaultAccounts) {
        await db.query(
          `INSERT INTO ${schema}.accounts (code, name, type) 
           VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
          [account.code, account.name, account.type]
        );
      }

      // Cache tenant info
      await redisClient.setex(
        `tenant:${companyId}:info`,
        3600,
        JSON.stringify({ companyId, companyName, schema })
      );

      return { success: true, schema };
    } catch (error) {
      console.error('Create tenant error:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete tenant
  async deleteTenant(companyId) {
    try {
      const schema = `company_${companyId}`;
      const db = await getTenantById('public');
      
      // Drop schema
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      
      // Remove from cache
      this.tenants.delete(companyId);
      await redisClient.del(`tenant:${companyId}:info`);

      return { success: true };
    } catch (error) {
      console.error('Delete tenant error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get tenant statistics
  async getTenantStats(companyId) {
    try {
      const cacheKey = `tenant:${companyId}:stats`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const db = await this.getTenantConfig(companyId);
      const schema = `company_${companyId}`;

      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM ${schema}.vouchers) as voucher_count,
          (SELECT COUNT(*) FROM ${schema}.accounts) as account_count,
          (SELECT SUM(balance) FROM ${schema}.accounts) as total_balance
      `);

      const result = stats.rows[0];
      
      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('Get tenant stats error:', error);
      return { error: error.message };
    }
  }

  // Validate tenant access
  async validateTenantAccess(userId, companyId) {
    try {
      const db = await this.getTenantConfig(companyId);
      const schema = `company_${companyId}`;

      const result = await db.query(
        `SELECT 1 FROM ${schema}.user_companies 
         WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Validate tenant access error:', error);
      return false;
    }
  }
}

// Singleton instance
const tenantService = new TenantService();
export default tenantService;