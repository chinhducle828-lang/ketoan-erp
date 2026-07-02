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

let inMemoryAccessToken = null;

export const setRAMToken = (token) => {
  inMemoryAccessToken = token;
};

const api = axios.create({
  baseURL: baseURL,
  timeout: 10000,
  withCredentials: true // Trao đổi HttpOnly Cookie
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

// SỬA ĐỔI: Dùng trực tiếp instance `api` để gọi refresh hoặc cấu hình bọc an toàn
const refreshAccessToken = async () => {
  // Dùng axios gốc nhưng phải đảm bảo đồng bộ hóa cấu hình nhận diện cookie nhận về
  const refreshRes = await axios.post(`${baseURL}/api/auth/refresh`, null, {
    withCredentials: true,
    headers: { 
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  
  const newToken = refreshRes.data?.accessToken || refreshRes.data?.data?.accessToken;
  
  if (newToken) {
    setRAMToken(newToken);
  }
  return newToken;
};

api.interceptors.request.use(
  (config) => {
    const token = inMemoryAccessToken;
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (!config.headers['Accept']) config.headers['Accept'] = 'application/json';
    return config;
  }, 
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // SỬA ĐỔI: Kiểm tra cả lỗi 401 lẫn kiểm tra nếu không phải request gọi API refresh bị lỗi
    if ((status === 401 || status === 419) && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh')) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          onRefreshed(newToken);
        } catch (refreshError) {
          isRefreshing = false;
          setRAMToken(null);
          try {
            localStorage.removeItem('user');
            localStorage.removeItem('activeCompany');
            // Nếu refresh lỗi (hết hạn hoàn toàn), đá người dùng về trang login
            window.location.href = '/login';
          } catch (e) {
            console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
          }
          return Promise.reject(refreshError);
        }
      }

      // SỬA ĐỔI: Tạo Promise bao bọc chuẩn để gọi lại một instance API mới tinh với config cũ
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          // Gọi lại bằng thực thể `api` để đi xuyên suốt lại toàn bộ quy trình request mới
          resolve(api(originalRequest));
        });
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;