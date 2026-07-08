/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { createTenantPool, getTenantDb } from './db';

// Tenant resolution middleware
export const tenantMiddleware = async (req, res, next) => {
  try {
    // Get tenant from subdomain or header
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0];
    const companyId = req.headers['x-company-id'] || req.query.companyId || subdomain;

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Attach tenant to request
    req.tenant = {
      companyId,
      schema: `company_${companyId}`
    };

    // Get tenant-specific database connection
    req.tenantDb = await getTenantDb(req.tenant.schema);

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({ error: 'Tenant resolution failed' });
  }
};

// Multi-tenant database configuration
export const createTenantConfig = (companyId) => {
  const schema = `company_${companyId}`;
  
  return {
    schema,
    pool: createTenantPool(schema),
    redis: {
      keyPrefix: `tenant:${companyId}:`
    }
  };
};

// Schema management
export const createTenantSchema = async (companyId) => {
  const schema = `company_${companyId}`;
  const db = await getTenantDb('public');
  
  // Create schema
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  
  // Create tables in schema
  const tables = [
    `CREATE TABLE IF NOT EXISTS ${schema}.vouchers (
      id SERIAL PRIMARY KEY,
      voucher_number VARCHAR(50) UNIQUE,
      type VARCHAR(20),
      date DATE,
      description TEXT,
      amount DECIMAL(15,2),
      status VARCHAR(20) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ${schema}.accounts (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) UNIQUE,
      name VARCHAR(100),
      type VARCHAR(20),
      balance DECIMAL(15,2) DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ${schema}.products (
      id SERIAL PRIMARY KEY,
      code VARCHAR(30) UNIQUE,
      name VARCHAR(100),
      price DECIMAL(15,2),
      quantity INTEGER DEFAULT 0
    )`
  ];

  for (const table of tables) {
    await db.query(table);
  }

  return schema;
};

// Get tenant by company ID
export const getTenantById = async (companyId) => {
  const schema = `company_${companyId}`;
  return {
    companyId,
    schema,
    db: await getTenantDb(schema)
  };
};