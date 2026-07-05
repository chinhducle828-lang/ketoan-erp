import axios from 'axios';
import wsService from './websocket';

// API base configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
      localStorage.removeItem('token');
      window.location.href = '/login';
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