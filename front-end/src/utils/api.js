import axios from 'axios';

// 1. Tự động nhận diện môi trường làm việc thông minh
let baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    baseURL = window.location.origin; 
  } else {
    baseURL = 'http://localhost:5000';
  }
}

// 2. BIẾN TOÀN CỤC LƯU TRÊN RAM (In-Memory Token) - Tiêu chuẩn bảo mật tối cao chống XSS
let inMemoryAccessToken = null;

// Hàm tiện ích để nạp Token trực tiếp vào bộ nhớ RAM khi xác thực thành công
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

// Global request handler: Tự động đính kèm token bảo mật từ RAM vào Header Authorization
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

// Global response handler: Tự động giải phóng dữ liệu và làm mới phiên làm việc ngầm khi Access Token hết hạn
api.interceptors.response.use(
  (res) => res.data, // Tự động bóc tách dữ liệu gốc từ Response thành công của Server
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // Ngăn chặn việc tự động Silent Refresh đối với chính các tuyến xác thực gốc để loại bỏ hoàn toàn nguy cơ lặp vô hạn
    const isAuthRoute = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh');

    // Chặn mã lỗi 401 hoặc 419 khi Access Token hết hạn hoặc bị hủy do reload trang
    if ((status === 401 || status === 419) && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          onRefreshed(newToken);
        } catch (refreshError) {
          isRefreshing = false;
          
          // Khi Refresh Token hết hiệu lực hoặc bị thu hồi, dọn sạch RAM và điều hướng an toàn
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

      // Đưa các request đang kẹt vào hàng đợi, tự động kích hoạt lại khi nhận được Token RAM mới
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    // Lỗi 403 (Forbidden) chỉ log cảnh báo hoặc để Component tự bắt lỗi xử lý UI
    if (status === 403) {
      console.warn('Tài khoản không có quyền truy cập tài nguyên hoặc chức năng này.');
    } else if (!error.response) {
      console.error('Network or CORS error calling API:', error.message || error);
    }
    
    // ĐÃ SỬA: Trả ra nguyên bản đối tượng Error của Axios để các khối try/catch của UI (như Login.jsx)
    // có thể đọc chính xác cấu trúc err.response?.data?.error
    return Promise.reject(error);
  }
);

// ====================================================================
// ĐỊNH NGHĨA CÁC HÀM GỌI API CHO TỪNG PHÂN HỆ VIEW FRONT-END (ĐỒNG BỘ TIỀN TỐ /api)
// ====================================================================

export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
};

export const cashAPI = {
  createVoucher: (data) => api.post('/api/cash', data), // Đã đồng bộ khớp với route.post('/') của phân hệ cash.routes.js
};

export const closingAPI = {
  getPeriods: (companyId, year) => api.get(`/api/closing?company_id=${companyId}&year=${year || new Date().getFullYear()}`), // Đồng bộ với closing.routes.js
  togglePeriod: (data) => api.post('/api/closing/toggle', data),
};

export const costsAPI = {
  calculateCosts: (data) => api.post('/api/vouchers', data), // Sử dụng hạch toán phiếu chung cho phân hệ giá thành
};

export const dashboardAPI = {
  getSummary: (companyId, year) => api.get(`/api/dashboard/summary?company_id=${companyId}&year=${year || new Date().getFullYear()}`),
};

export const hrAPI = {
  createPayroll: (data) => api.post('/api/hr/payroll', data), // Đồng bộ với hr.routes.js
};

export const purchasingAPI = {
  createInvoice: (data) => api.post('/api/purchasing', data), // Đồng bộ khớp với route.post('/') của purchasing.routes.js
};

export const salesAPI = {
  createInvoice: (data) => api.post('/api/sales', data), // Đồng bộ khớp với route.post('/') của sales.routes.js
};

export const taxAPI = {
  getVATReports: (companyId, period) => api.get(`/api/tax/reports?company_id=${companyId}&period=${period}`),
  performDeduction: (data) => api.post('/api/tax/deduction', data),
};

export default api;