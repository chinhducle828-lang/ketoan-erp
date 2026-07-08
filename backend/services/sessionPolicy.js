/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

const STOREFRONT_ONLY_ROLES = ['nv', 'nv_banhang', 'nv_kho'];

export const shouldClearExistingSessions = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return !STOREFRONT_ONLY_ROLES.includes(normalizedRole);
};
