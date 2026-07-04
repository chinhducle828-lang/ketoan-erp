const STOREFRONT_SUPPORTED_ROLES = ['guest', 'admin', 'nv_banhang', 'nv_kho'];
const STOREFRONT_ONLY_ROLES = ['nv_banhang', 'nv_kho'];

export const normalizeStorefrontRole = (roleCode) => {
  const normalized = String(roleCode || '').trim().toLowerCase();
  return STOREFRONT_SUPPORTED_ROLES.includes(normalized) ? normalized : 'guest';
};

export const isStorefrontOnlyRole = (roleCode) => {
  const normalized = String(roleCode || '').trim().toLowerCase();
  return STOREFRONT_ONLY_ROLES.includes(normalized);
};

export const isStorefrontSupportedRole = (roleCode) => {
  const normalized = String(roleCode || '').trim().toLowerCase();
  return STOREFRONT_SUPPORTED_ROLES.includes(normalized);
};
