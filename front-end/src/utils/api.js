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
  baseURL: baseURL
});

// Global request handler: Tự động đính kèm token bảo mật vào Header
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    if (error.response?.status === 401) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        localStorage.removeItem('activeCompany');
      } catch (e) {
        console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
      }
      
      // Chuyển hướng an toàn về màn hình đăng nhập gốc
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;   