/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export const getStorefrontURL = () => {
  const configuredUrl = import.meta.env.VITE_STOREFRONT_URL || import.meta.env.VITE_STOREFRONT_BASE_URL || '';
  if (configuredUrl) return configuredUrl;

  if (typeof window === 'undefined') return '';

  const protocol = import.meta.env.VITE_STOREFRONT_PROTOCOL || window.location.protocol;
  const host = import.meta.env.VITE_STOREFRONT_HOST || window.location.hostname;
  const port = import.meta.env.VITE_STOREFRONT_PORT || '3001';

  if (['localhost', '127.0.0.1'].includes(host)) {
    return `${protocol}//${host}:${port}`;
  }

  return import.meta.env.VITE_STOREFRONT_RAILWAY_URL || '';
};

export default getStorefrontURL;
