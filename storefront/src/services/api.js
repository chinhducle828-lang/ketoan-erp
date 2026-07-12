/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import axios from 'axios';
import wsService from './websocket';

// API base configuration - Use VITE_ prefix for Vite
const API_BASE_URL = (() => {
  const configuredUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_BASE_URL || '';
  if (configuredUrl) {
    const normalized = String(configuredUrl).trim().replace(/\/$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
    return isLocalHost ? `${protocol}//${hostname}:5000/api` : `${origin}/api`;
  }
  return 'http://localhost:5000/api';
})();
const ERP_FALLBACK_URL = import.meta.env.VITE_ERP_URL || import.meta.env.VITE_APP_ERP_URL || '';

// Track if we're in the initial authentication phase to prevent unwanted redirects
let isAuthenticating = false;

// Export function to control authentication state
export const setAuthenticating = (value) => {
  isAuthenticating = value;
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for HttpOnly cookies
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    // Try multiple token keys for compatibility
    const token = localStorage.getItem('erp_token') || localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Determine if this was a Bearer-token request or cookie-based request
      const hadBearerHeader = error.config?.headers?.Authorization?.startsWith('Bearer ');
      
      if (hadBearerHeader) {
        // Token-based request failed - token is expired/invalid
        localStorage.removeItem('erp_token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        localStorage.removeItem('storefrontAccessToken');
      }
      // For cookie-based requests (without Bearer), do NOT clear tokens
      // The component will handle the 401 gracefully via its own logic
      
      // Avoid hard navigation for transient auth failures. Let the UI handle the expired session locally.
      if (!isAuthenticating && hadBearerHeader) {
        const erpUrl = localStorage.getItem('erpUrl') || ERP_FALLBACK_URL || window.location.origin;
        try {
          window.dispatchEvent(new CustomEvent('storefront:auth-expired', {
            detail: { message: 'Phiên xác thực storefront đã hết hạn. Vui lòng đăng nhập lại từ ERP.' }
          }));
          if (erpUrl && erpUrl !== window.location.origin && erpUrl.startsWith('http')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch {
          // Ignore event dispatch failures and fall back silently.
        }
      }
    }
    return Promise.reject(error);
  }
);

// API methods with WebSocket integration
export const voucherAPI = {
  // Get all vouchers
  getAll: (params) => api.get('/vouchers', { params }),
  
  // Get voucher by ID
  getById: (id) => api.get(`/vouchers/${id}`),
  
  // Create voucher
  create: async (data) => {
    const response = await api.post('/vouchers', data);
    // WebSocket will emit voucherCreated from backend
    return response;
  },
  
  // Update voucher
  update: async (id, data) => {
    const response = await api.put(`/vouchers/${id}`, data);
    // WebSocket will emit voucherUpdated from backend
    return response;
  },
  
  // Delete voucher
  delete: (id) => api.delete(`/vouchers/${id}`)
};

export const orderAPI = {
  // Get all orders
  getAll: (params) => api.get('/orders', { params }),
  
  // Get order by ID
  getById: (id) => api.get(`/orders/${id}`),
  
  // Create order
  create: (data) => api.post('/orders', data),
  
  // Update order status
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status })
};

export const productAPI = {
  // Get all products
  getAll: (params) => api.get('/products', { params }),
  
  // Get product by ID
  getById: (id) => api.get(`/products/${id}`),
  
  // Get inventory
  getInventory: (id) => api.get(`/products/${id}/inventory`)
};

// Initialize WebSocket with auth
export const initWebSocket = (companyId, userId) => {
  wsService.connect(companyId, userId);
};

// Export default
export default api;