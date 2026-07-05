import axios from 'axios';
import wsService from './websocket';

// API base configuration - Use VITE_ prefix for Vite
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
      // Clear auth and redirect to ERP login
      localStorage.removeItem('erp_token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('companyId');
      localStorage.removeItem('userId');
      
      // Redirect to ERP login
      const erpUrl = localStorage.getItem('erpUrl') || 'https://ketoanonline.up.railway.app';
      window.location.href = erpUrl;
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