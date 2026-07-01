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
  timeout: 10000,
  withCredentials: true
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRrefreshed = (token) => {
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
    localStorage.setItem('token', newToken);
  }
  return newToken;
};

// Global request handler: Tự động đính kèm token bảo mật vào Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
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

// Global response handler: refresh token on 401 then retry once
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          onRrefreshed(newToken);
        } catch (refreshError) {
          isRefreshing = false;
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('activeCompany');
          } catch (e) {
            console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
          }
          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            // ĐÃ SỬA: Tạm thời khóa dòng điều hướng này để tránh vòng lặp vô hạn ép tải lại trang
            // window.location.href = '/';
          }
          return Promise.reject(refreshError);
        }
      }

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

    if (status === 403) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('activeCompany');
      } catch (e) {
        console.error('Không thể dọn dẹp bộ nhớ phiên làm việc:', e);
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        // ĐÃ SỬA: Tạm thời khóa dòng điều hướng này để tránh vòng lặp vô hạn ép tải lại trang
        // window.location.href = '/';
      }
    } else if (!error.response) {
      console.error('Network or CORS error calling API:', error.message || error);
    }
    return Promise.reject(error);
  }
);

export default api;

//