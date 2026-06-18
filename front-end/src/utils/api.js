import axios from 'axios';

// Sử dụng API_URL từ environment variable hoặc mặc định là localhost
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: baseURL
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;

// api.js
// Global response handler: if server invalidates session (401), clear session and redirect to login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      } catch (e) {}
      // redirect to root/login
      if (typeof window !== 'undefined') window.location.href = '/';
    }
    return Promise.reject(error);
  }
);