// FILE_PATH: front-end/src/utils/api.js
import axios from 'axios';

// ✅ TỰ ĐỘNG KHỞI TẠO BASE URL THEO MÔI TRƯỜNG DỰ ÁN
const getBaseURL = () => {
  const base = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (base) {
    if (base.includes('your-backend-domain')) {
      console.error('[KETOAN-FRONTEND] VITE_API_BASE_URL vẫn dùng placeholder `your-backend-domain`. Hãy thay bằng backend Railway service thực tế.');
    }
    return base.endsWith('/api') ? base : `${base.replace(/\/$/, '')}/api`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '/api';
    }
  }

  console.warn('[KETOAN-FRONTEND] Không tìm thấy VITE_API_BASE_URL. Đang dùng /api làm fallback.');
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(), 
  withCredentials: true,  // Giữ nguyên để nhận/gửi cookie HttpOnly an toàn giữa 2 domain
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Đính kèm mã định danh pháp nhân hạch toán và token bảo mật
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // Tự động kiểm tra và cấu hình ID doanh nghiệp đang làm việc vào Header hệ thống
    const activeCompanyData = localStorage.getItem('activeCompany');
    if (activeCompanyData) {
      try {
        const company = JSON.parse(activeCompanyData);
        if (company && company.id) {
          config.headers['X-Company-Id'] = company.id;
          config.params = {
            ...config.params,
            company_id: company.id
          };
        }
      } catch (e) {
        console.error('Lỗi định dạng cấu hình activeCompany', e);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

//