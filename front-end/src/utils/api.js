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

// Sửa lỗi chính tả từ onRrefreshed thành onRefreshed
const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  const refreshRes = await axios.post(`${baseURL}/api/auth/refresh`, null, {
    withCredentials: true,
    headers: { Accept: 'application/json' }
  });
  
  const newToken = refreshRes.data?.accessToken;
  if (newToken) {
    // ĐÃ SỬA: Nạp vào RAM, tuyệt đối KHÔNG đưa vào localStorage nữa
    setRAMToken(newToken);
  }
  return newToken;
};

// Global request handler: Tự động đính kèm token bảo mật từ RAM vào Header
api.interceptors.request.use(
  (config) => {
    // ĐÃ SỬA: Lấy từ RAM (Biến tạm) thay vì localStorage
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

    // Chặn mã lỗi 401 (hoặc 419 tùy Backend của bạn) khi Token trên RAM hết hạn
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
          
          // Nếu Cookie 7 ngày cũng hết hạn -> Xóa RAM và dọn sạch session cũ
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

    // Xử lý khi lỗi phân quyền chéo 403
    if (status === 403) {
      try {
        setRAMToken(null); // Xóa sạch Token khỏi RAM ngay lập tức để bảo vệ hệ thống
        localStorage.removeItem('user');
        localStorage.removeItem('activeCompany');
      } catch (e) {
        console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
      }
    } else if (!error.response) {
      console.error('Network or CORS error calling API:', error.message || error);
    }
    return Promise.reject(error);
  }
);

export default api;