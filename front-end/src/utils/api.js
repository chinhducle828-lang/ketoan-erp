/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/utils/api.js
import axios from 'axios';
import { getClientInstanceId } from './clientInstance.js';

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

// ====================================================================
// SILENT REFRESH (single-flight + cooldown) - Đồng bộ lại phiên khi access token hết hạn
// ====================================================================
// - Chỉ tạo tối đa 1 request /auth/refresh tại một thời điểm (tránh bão hòa).
// - Có cooldown sau mỗi lần refresh thất bại (lỗi tạm thời 429/500/network)
//   để KHÔNG tạo vòng lặp gọi refresh trên mọi request khi backend/network gián đoạn.
// - CHỈ đăng xuất khi refresh trả về 401 (phiên thực sự hết hạn / mất cookie).
//   Các lỗi tạm thời KHÔNG đăng xuất → giữ nguyên phiên, tránh mất ổn định đột ngột.
let refreshPromise = null;
let refreshCooldownUntil = 0;
const REFRESH_COOLDOWN_MS = 10 * 1000; // 10 giây

const doSilentRefresh = () => {
  const now = Date.now();
  if (now < refreshCooldownUntil) {
    return Promise.reject(new Error('refresh-cooldown'));
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (data && data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          return data.accessToken;
        }
        throw new Error('silent-refresh-no-token');
      } finally {
        // Giải phóng để các lần sau có thể thử lại
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

// Response Interceptor: Xử lý 401 toàn hệ thống - tự động đồng bộ lại phiên
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    // Không thử refresh với chính endpoint refresh, và chỉ retry 1 lần/request
    const isRefreshCall = String(originalRequest.url || '').includes('/auth/refresh');
    const alreadyRetried = originalRequest._retry === true;

    if (status === 401 && !isRefreshCall && !alreadyRetried) {
      const hadToken = localStorage.getItem('accessToken');
      if (hadToken) {
        try {
          const newToken = await doSilentRefresh();
          // Cập nhật token và thử lại request gốc để duy trì đồng bộ phiên
          originalRequest._retry = true;
          originalRequest.headers = { ...(originalRequest.headers || {}) };
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          const refreshStatus = refreshErr?.response?.status;
          // Chỉ đăng xuất khi refresh thực sự trả về 401 (cookie/phiên đã mất).
          if (refreshStatus === 401) {
            localStorage.removeItem('accessToken');
            try {
              window.dispatchEvent(new CustomEvent('erp:auth-expired', {
                detail: { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
              }));
            } catch (e) { /* ignore */ }
          } else {
            // Lỗi tạm thời (429/500/network): KHÔNG đăng xuất, đặt cooldown để
            // tránh bão gọi refresh, giữ nguyên trang cho người dùng tiếp tục thao tác.
            refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Request Interceptor: Đính kèm mã định danh pháp nhân hạch toán và token bảo mật
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Client-Instance-Id'] = getClientInstanceId();
    
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // Các endpoint cấp hệ thống (không nên auto-scope theo company_id)
    const rawUrl = String(config.url || '');
    const shouldSkipAutoCompanyScope = rawUrl.includes('/inventory/audit-logs');

    // Tự động kiểm tra và cấu hình ID doanh nghiệp đang làm việc vào Header hệ thống
    const activeCompanyData = localStorage.getItem('activeCompany');
    if (activeCompanyData && !shouldSkipAutoCompanyScope) {
      try {
        const company = JSON.parse(activeCompanyData);
        const hasCompanyIdParam = config.params?.company_id || config.params?.companyId || /[?&](company_id|companyId)=/.test(config.url || '');
        if (company && company.id && !hasCompanyIdParam) {
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

// ====================================================================
// OTP SIGNING API FUNCTIONS
// ====================================================================

/**
 * Request OTP for document signing
 */
export const requestOtpForSigning = async ({ voucherId, companyId, documentType = 'voucher' }) => {
  const response = await api.post('/signing/request-otp', {
    voucherId,
    companyId,
    documentType
  });
  return response.data;
};

/**
 * Verify OTP and sign document
 */
export const verifyOtpAndSign = async ({ voucherId, companyId, otp, documentType = 'voucher' }) => {
  const response = await api.post('/signing/verify', {
    voucherId,
    companyId,
    otp,
    documentType
  });
  return response.data;
};

/**
 * Get signing status of a document
 */
export const getSigningStatus = async (voucherId, companyId) => {
  const response = await api.get(`/signing/status/${voucherId}`, {
    params: { companyId }
  });
  return response.data;
};

/**
 * Cancel signing request
 */
export const cancelSigningRequest = async ({ voucherId, companyId }) => {
  const response = await api.post('/signing/cancel', {
    voucherId,
    companyId
  });
  return response.data;
};

export default api;
