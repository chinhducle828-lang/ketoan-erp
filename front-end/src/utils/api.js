import axios from 'axios';

// 1. Tự động nhận diện môi trường làm việc
let baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    baseURL = window.location.origin; 
  } else {
    baseURL = 'http://localhost:5000';
  }
}

// 2. BIẾN TOÀN CỤC LƯU TRÊN RAM (In-Memory Token) - Bảo mật cấp độ cao nhất
let inMemoryAccessToken = null;

// Hàm tiện ích để file Login.jsx hoặc App.jsx nạp token vào RAM khi đăng nhập thành công
export const setRAMToken = (token) => {
  inMemoryAccessToken = token;
};

// Khởi tạo cấu hình Axios mặc định kết nối đến Backend
const api = axios.create({
  baseURL: baseURL,
  timeout: 10000,
  withCredentials: true // THẦN CHÚ: Bắt buộc để tự động trao đổi HttpOnly Cookie với Backend
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  const refreshRes = await axios.post(`${baseURL}/api/auth/refresh`, null, {
    withCredentials: true,
    headers: { Accept: 'application/json' }
  });
  
  // Hỗ trợ cả 2 định dạng trả về phổ biến của Backend (Phẳng hoặc bọc trong data)
  const newToken = refreshRes.data?.accessToken || refreshRes.data?.data?.accessToken;
  
  if (newToken) {
    setRAMToken(newToken);
  }
  return newToken;
};

// Global request handler: Tự động đính kèm token bảo mật từ RAM vào Header
api.interceptors.request.use(
  (config) => {
    const token = inMemoryAccessToken;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    config.headers = config.headers || {};
    if (!config.headers.Accept) config.headers.Accept = 'application/json';
    return config;
  }, 
  (error) => {
    return Promise.reject(error);
  }
);

// Global response handler: Tự động chạy ngầm xin cấp lại Token mới khi RAM bị xóa/hết hạn
api.interceptors.response.use(
  (res) => res.data, // Tự động bóc tách data từ response để UI dùng trực tiếp
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // Chặn mã lỗi 401 hoặc 419 khi Access Token trên RAM hết hạn hoặc bị hủy do F5 reload trang
    if ((status === 401 || status === 419) && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          onRefreshed(newToken);
        } catch (refreshError) {
          isRefreshing = false;
          
          // When refresh token expires or is revoked, force clear local memory and logout
          setRAMToken(null);
          try {
            localStorage.removeItem('user');
            localStorage.removeItem('activeCompany');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
               window.location.href = '/auth/login';
            }
          } catch (e) {
            console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
          }
          return Promise.reject(refreshError);
        }
      }

      // Đưa các request bị kẹt vào hàng đợi, chờ khi có Token trên RAM mới sẽ tự động kích hoạt chạy tiếp
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            // Vì interceptor ở trên trả về res.data, nên khi retry ta cũng cần đảm bảo cấu trúc
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    // Lỗi 403 (Forbidden) chỉ log ra hoặc để Component bắt lỗi render cảnh báo UI
    if (status === 403) {
      console.warn('Tài khoản không có quyền truy cập tài nguyên hoặc chức năng này.');
    } else if (!error.response) {
      console.error('Network or CORS error calling API:', error.message || error);
    }
    
    return Promise.reject(error.response?.data || error);
  }
);

// ====================================================================
// ĐỊNH NGHĨA CÁC HÀM GỌI API CHO TỪNG PHÂN HỆ VIEW FRONT-END
// ====================================================================

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

export const cashAPI = {
  createVoucher: (data) => api.post('/cash/voucher', data),
};

export const closingAPI = {
  getPeriods: (companyId, year) => api.get(`/closing/periods?company_id=${companyId}&year=${year || new Date().getFullYear()}`),
  togglePeriod: (data) => api.post('/closing/toggle', data),
};

export const costsAPI = {
  calculateCosts: (data) => api.post('/costs', data),
};

export const dashboardAPI = {
  getSummary: (companyId, year) => api.get(`/dashboard/summary?company_id=${companyId}&year=${year || new Date().getFullYear()}`),
};

export const hrAPI = {
  createPayroll: (data) => api.post('/hr/payroll', data),
};

export const purchasingAPI = {
  createInvoice: (data) => api.post('/purchasing/voucher', data),
};

export const salesAPI = {
  createInvoice: (data) => api.post('/sales/voucher', data),
};

export const taxAPI = {
  getVATReports: (companyId, period) => api.get(`/tax/reports?company_id=${companyId}&period=${period}`),
  performDeduction: (data) => api.post('/tax/deduction', data),
};

// ✅ XUẤT BẢN INSTANCE MẶC ĐỊNH
// Toàn bộ các phân hệ bao gồm cả VoucherContext.jsx sẽ sử dụng instance này 
// để tự động hưởng cơ chế Interceptor (Đính kèm token và Tự động refresh token ngầm)
export default api;