import axios from 'axios';

// API base URL configuration
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://dazzling-grace-production-03a5.up.railway.app';
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

// Add response interceptor to authApi to handle 401 errors gracefully
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear expired auth tokens silently - no redirect
      const hadToken = localStorage.getItem('storefrontAccessToken');
      localStorage.removeItem('storefrontAccessToken');
      localStorage.removeItem('erp_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      
      // If a storefront token was cleared, dispatch custom event so the UI can react
      if (hadToken) {
        try {
          window.dispatchEvent(new CustomEvent('storefront:auth-expired', { detail: { message: 'Phiên đăng nhập đã hết hạn. Tiếp tục sử dụng chế độ khách.' } }));
        } catch (e) { /* ignore dispatch errors */ }
      }
      
      // Do NOT redirect to ERP - let the component handle the 401 gracefully
      // The EventSource stream and polling will continue using cookies as fallback
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

export { API_BASE_URL };