// FILE_PATH: front-end/src/utils/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Cho phép truyền Cookie / Refresh Token tự động mã hóa
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
    
    // Tự động kiểm tra và cấu hình ID doanh nghiệp đang làm việc vào Header hệ thống
    const activeCompanyData = localStorage.getItem('activeCompany');
    if (activeCompanyData) {
      try {
        const company = JSON.parse(activeCompanyData);
        if (company && company.id) {
          config.headers['X-Company-Id'] = company.id;
          // Đồng thời gắn vào query params để đảm bảo đồng bộ hoàn toàn
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