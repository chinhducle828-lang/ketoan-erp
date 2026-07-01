import { pool } from '../server.js';

export const normalizeCompanyIds = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((id) => id !== null && id !== undefined && id !== '')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return [Number(value)].filter((id) => Number.isInteger(id) && id > 0);
};

export const syncUserCompanyLinks = async (userId, companyIds) => {
  const normalized = normalizeCompanyIds(companyIds);
  await pool.query('DELETE FROM user_companies WHERE user_id = $1', [userId]);

  if (normalized.length > 0) {
    for (const companyId of normalized) {
      await pool.query(
        'INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, companyId]
      );
    }
  }

  return normalized;
};

export const canAccessCompany = async (user, companyId) => {
  if (!companyId) return false;
  if (user.role === 'admin') return true;

  const result = await pool.query(
    'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
    [user.id, companyId]
  );

  return result.rows.length > 0;
};

export const getCompanyIdsForUser = async (user) => {
  if (user.role === 'admin') return [];

  const result = await pool.query(
    'SELECT company_id FROM user_companies WHERE user_id = $1 ORDER BY company_id',
    [user.id]
  );

  return result.rows.map((row) => Number(row.company_id));
};