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
  (res) => res,
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
          
          // Khi cả HttpOnly Refresh Cookie cũng hết hạn (hoặc bị thu hồi) -> Lúc này mới ép đăng xuất
          setRAMToken(null);
          try {
            localStorage.removeItem('user');
            localStorage.removeItem('activeCompany');
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
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    // CHỈNH SỬA: Lỗi 403 (Forbidden) chỉ log ra hoặc để Component bắt lỗi render cảnh báo UI, 
    // KHÔNG xóa phiên đăng xuất của user nữa.
    if (status === 403) {
      console.warn('Tài khoản không có quyền truy cập tài nguyên hoặc chức năng này.');
    } else if (!error.response) {
      console.error('Network or CORS error calling API:', error.message || error);
    }
    
    return Promise.reject(error);
  }
);

// ====================================================================
// ✅ CÁC HÀM API BỔ SUNG: PHÂN HỆ QUẢN LÝ KHO & VẬT TƯ (MASTER-DETAIL)
// ====================================================================

/**
 * Gửi toàn bộ dữ liệu Phiếu Nhập / Xuất kho (Hạch toán đa dòng) lên Backend
 * @param {Object} voucherData - Bao gồm thông tin phiếu và mảng details
 */
export const createInventoryVoucher = async (voucherData) => {
  const response = await api.post('/api/inventory/vouchers', voucherData);
  return response.data;
};

// Xuất bản instance làm mặc định cho các phân hệ cũ
export default api;