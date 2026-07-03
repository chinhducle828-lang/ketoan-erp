// FILE_PATH: front-end/src/utils/api.js
import axios from 'axios';

// ✅ TỰ ĐỘNG KHỞI TẠO BASE URL THEO MÔI TRƯỜNG DỰ ÁN
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    // 🌟 ĐÃ SỬA: Gom nhóm ngoặc đơn chuẩn xác để tránh lỗi logic thứ tự ưu tiên toán tử
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost:3000') {
      return '/api'; // Dùng proxy Vite cấu hình sẵn ở local
    }
  }
  // 🔴 KHI LÊN RAILWAY PRODUCTION: Ép cứng trỏ thẳng về endpoint /api của Backend Railway
  return 'https://dazzling-grace-production-03a5.up.railway.app/api';
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

//