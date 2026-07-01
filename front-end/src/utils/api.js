import axios from 'axios';

// Giải pháp thông minh: Tự động nhận diện môi trường làm việc
let baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  // Nếu biến môi trường trống và đang chạy thực tế trên môi trường web (Railway)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // Tự động lấy domain hiện tại làm gốc cho API (Áp dụng khi deploy chung project/monorepo)
    baseURL = window.location.origin; 
  } else {
    // Nếu chạy dưới máy cá nhân (Local Development)
    baseURL = 'http://localhost:5000';
  }
}

const api = axios.create({
  baseURL: baseURL,
  timeout: 10000
});

// Global request handler: Tự động đính kèm token bảo mật vào Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // ensure we accept json by default
    config.headers = config.headers || {};
    if (!config.headers.Accept) config.headers.Accept = 'application/json';
    return config;
  }, 
  (error) => {
    return Promise.reject(error);
  }
);

// Global response handler: Nếu phiên làm việc hết hạn (401), dọn dẹp hệ thống và đá về trang login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('activeCompany');
      } catch (e) {
        console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
      }

      if (typeof window !== 'undefined') {
        // If already on login page, don't redirect again
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    } else if (!error.response) {
      // Network or CORS error
      console.error('Network or CORS error calling API:', error.message || error);
    }
    return Promise.reject(error);
  }
);

export default api;   