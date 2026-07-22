/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import axios from 'axios';

// API base URL configuration
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
if (!API_BASE_URL) {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
    API_BASE_URL = isLocalHost ? `${protocol}//${hostname}:5000` : origin;
  } else {
    API_BASE_URL = 'http://localhost:5000';
  }
}
if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}
API_BASE_URL = API_BASE_URL.replace(/\/$/, '');

// Track if we're in the initial authentication phase to prevent unwanted redirects
let isAuthenticating = false;

// Export function to control authentication state
export const setAuthenticating = (value) => {
  isAuthenticating = value;
};

// Public API for unauthenticated requests
export const publicApi = axios.create({
  baseURL: `${API_BASE_URL}/api/public`,
  withCredentials: false
});

// Auth API for authenticated requests
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Add request interceptor to automatically add Authorization header from localStorage
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('storefrontAccessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to authApi to handle 401 errors gracefully
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only clear token if the request was actually using a Bearer token.
      // Cookie-based requests (without Authorization header) that get 401
      // should NOT clear the token, as they are unrelated to token auth.
      const hadBearerHeader = error.config?.headers?.Authorization?.startsWith('Bearer ');
      const hadToken = localStorage.getItem('storefrontAccessToken');
      
      if (hadBearerHeader && hadToken) {
        // Token-based request failed with 401 - token is expired/invalid
        localStorage.removeItem('storefrontAccessToken');
        localStorage.removeItem('erp_token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        
        try {
          window.dispatchEvent(new CustomEvent('storefront:auth-expired', { detail: { message: 'Phiên đăng nhập đã hết hạn. Tiếp tục sử dụng chế độ khách.' } }));
        } catch (e) { /* ignore dispatch errors */ }
      }
      // If no Bearer header was used, this is a cookie-based session 401.
      // Do NOT clear the storefront token - it may still be valid.
      // The component will handle the 401 gracefully via its own logic.
    }
    return Promise.reject(error);
  }
);

// Get ERP URL
export const getERPUrl = () => {
  const envUrl = normalizeAbsoluteUrl(import.meta.env.VITE_ERP_URL);
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const fromQuery = normalizeAbsoluteUrl(new URLSearchParams(window.location.search).get('erp_url'));
    if (fromQuery) return fromQuery;

    const referrer = normalizeAbsoluteUrl(window.document?.referrer);
    if (referrer) {
      try {
        const current = new URL(window.location.href);
        const source = new URL(referrer);
        if (source.origin !== current.origin) return source.origin;
      } catch {
        // ignore invalid referrer URL
      }
    }
  }

  return '';
};

// Normalize URL helper
const normalizeAbsoluteUrl = (value) => {
  if (!value) return '';
  let raw = String(value).trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

// Get admin auth config
export const getAdminAuthConfig = (token) => {
  if (token) return { headers: { Authorization: `Bearer ${token}` } };
  return { withCredentials: true };
};

// Load items from API
export const loadItems = async (id) => {
  if (!id) return [];
  try {
    const { data } = await publicApi.get('/items', { params: { company_id: id } });
    return data || [];
  } catch (err) {
    throw err;
  }
};

// Create order
export const createOrder = async (payload) => {
  try {
    const { data } = await publicApi.post('/orders', payload);
    return data;
  } catch (err) {
    throw err;
  }
};

// Lookup or create partner by phone
export const findOrCreatePartner = async (companyId, partnerData) => {
  try {
    const { data } = await publicApi.post('/partners/find-or-create', {
      company_id: companyId,
      partner_name: partnerData.partner_name,
      phone: partnerData.phone,
      address: partnerData.address,
      type: 'customer'
    });
    return data;
  } catch (err) {
    throw err;
  }
};

// Load warehouse queue
export const loadWarehouseQueue = async (companyId, token) => {
  if (!companyId) return [];
  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/logistics/queue-details`, {
      params: { company_id: companyId },
      ...getAdminAuthConfig(token)
    });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw err;
  }
};

// Admin item operations
export const adminItemApi = {
  create: async (payload, token) => {
    return axios.post(`${API_BASE_URL}/api/items`, payload, getAdminAuthConfig(token));
  },
  update: async (code, payload, token) => {
    return axios.put(`${API_BASE_URL}/api/items/${encodeURIComponent(code)}`, payload, getAdminAuthConfig(token));
  },
  delete: async (code, companyId, token) => {
    return axios.delete(`${API_BASE_URL}/api/items/${encodeURIComponent(code)}`, {
      ...getAdminAuthConfig(token),
      params: { company_id: Number(companyId) }
    });
  }
};

// Warehouse operations
export const warehouseApi = {
  assignTruck: async (companyId, voucherId, truckId, token) => {
    return axios.post(`${API_BASE_URL}/api/logistics/assign-truck`, {
      companyId: Number(companyId),
      voucherId: Number(voucherId),
      truckId: truckId || null
    }, getAdminAuthConfig(token));
  },
  confirmLoaded: async (companyId, voucherId, token) => {
    return axios.post(`${API_BASE_URL}/api/logistics/confirm-loaded`, {
      companyId: Number(companyId),
      voucherId: Number(voucherId)
    }, getAdminAuthConfig(token));
  },
  markCompleted: async (companyId, voucherId, token) => {
    return axios.post(`${API_BASE_URL}/api/logistics/mark-completed`, {
      companyId: Number(companyId),
      voucherId: Number(voucherId)
    }, getAdminAuthConfig(token));
  }
};

// Auth operations
export const authOperations = {
  externalLogin: async (erpToken, companyId, role) => {
    return authApi.post('/api/auth/external-login', { erp_token: erpToken, company_id: companyId, role });
  },
  me: async (token) => {
    if (token) {
      return authApi.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    }
    return authApi.get('/api/auth/me');
  }
};

// System config operations
export const systemConfigApi = {
  /**
   * Get a single system config value
   * @param {string} key - Config key (e.g., 'tax.standard_rate')
   * @param {number|null} companyId - Optional company ID for company-specific config
   * @returns {Promise<{success: boolean, value: any, source: string}>}
   */
  getConfig: async (key, companyId = null) => {
    try {
      const params = {};
      if (companyId) {
        params.company_id = companyId;
      }
      const { data } = await authApi.get(`/api/settings/config/${encodeURIComponent(key)}`, { params });
      return data;
    } catch (err) {
      console.error(`Error fetching config ${key}:`, err);
      return { success: false, value: null, source: 'error' };
    }
  },

  /**
   * Get multiple system configs at once
   * @param {string[]} keys - Array of config keys
   * @param {number|null} companyId - Optional company ID
   * @returns {Promise<Object>} Object with config keys as properties
   */
  getBatchConfigs: async (keys, companyId = null) => {
    try {
      const { data } = await authApi.post('/api/settings/configs/batch', { keys, company_id: companyId });
      if (data.success) {
        // Flatten the response to { key: value } instead of { key: { value, source } }
        const result = {};
        for (const [key, config] of Object.entries(data.configs)) {
          result[key] = config?.value ?? null;
        }
        return result;
      }
      return {};
    } catch (err) {
      console.error('Error fetching batch configs:', err);
      return {};
    }
  },

  /**
   * Get tax rate (convenience method)
   * @param {number|null} companyId - Optional company ID
   * @returns {Promise<number>} Tax rate as decimal (e.g., 0.08)
   */
  getTaxRate: async (companyId = null) => {
    try {
      const result = await systemConfigApi.getConfig('tax.standard_rate', companyId);
      if (result.success && result.value !== null) {
        return parseFloat(result.value);
      }
    } catch (err) {
      // Config not found or error - use fallback
    }
    // Fallback to default 8%
    return 0.08;
  }
};

export { API_BASE_URL };
