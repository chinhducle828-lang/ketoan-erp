/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export const resolveApiBaseUrl = (env = import.meta.env, location) => {
  const resolvedEnv = env || {};
  const resolvedLocation = location || (typeof window !== 'undefined' ? window.location : {});
  const configuredUrl = resolvedEnv?.VITE_API_BASE_URL || resolvedEnv?.VITE_API_URL || '';
  if (configuredUrl) {
    const normalized = String(configuredUrl).trim().replace(/\/$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  if (!resolvedLocation || typeof resolvedLocation !== 'object') {
    return 'http://localhost:5000/api';
  }

  const protocol = resolvedLocation.protocol || 'http:';
  const hostname = resolvedLocation.hostname || resolvedLocation.host || 'localhost';
  const origin = resolvedLocation.origin || `${protocol}//${hostname}`;
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);

  if (isLocalHost) {
    return '/api';
  }

  return `${origin}/api`;
};

export default resolveApiBaseUrl;
