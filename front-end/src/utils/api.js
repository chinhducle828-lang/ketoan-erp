/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/utils/api.js
import axios from 'axios';
import { getClientInstanceId } from './clientInstance.js';
import { resolveApiBaseUrl } from './apiBaseUrl.js';

// In-memory token storage (more secure than localStorage - not accessible via XSS)
let memoryToken = null;

const getBaseURL = () => {
  const base = resolveApiBaseUrl();
  if (base.includes('your-backend-domain')) {
    console.error('[KETOAN-FRONTEND] VITE_API_BASE_URL vẫn dùng placeholder `your-backend-domain`. Hãy thay bằng backend Railway service thực tế.');
  }
  return base;
};

const api = axios.create({
  baseURL: getBaseURL(), 
  withCredentials: true,  // Cookies are used for auth primarily (HttpOnly)
  headers: {
    'Content-Type': 'application/json'
  }
});

// ====================================================================
// TOKEN MANAGEMENT - Uses in-memory storage instead of localStorage
// to prevent XSS-based token theft
// ====================================================================

/**
 * Set access token in memory (NOT localStorage)
 */
export const setAccessToken = (token) => {
  memoryToken = token;
};

/**
 * Get access token from memory
 */
export const getAccessToken = () => memoryToken;

/**
 * Clear access token on logout
 */
export const clearAccessToken = () => {
  memoryToken = null;
};

// ====================================================================
// SILENT REFRESH (single-flight + cooldown) - Đồng bộ lại phiên khi access token hết hạn
// ====================================================================
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
          // Store in memory instead of localStorage
          setAccessToken(data.accessToken);
          return data.accessToken;
        }
        throw new Error('silent-refresh-no-token');
      } finally {
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
      const hadToken = getAccessToken();
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
            clearAccessToken();
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
    // Get token from memory instead of localStorage
    const token = getAccessToken();
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
    // Store only company ID (not full object) for security
    const activeCompanyId = localStorage.getItem('activeCompanyId');
    if (activeCompanyId && !shouldSkipAutoCompanyScope) {
      const companyId = parseInt(activeCompanyId, 10);
      if (companyId > 0) {
        const hasCompanyIdParam = config.params?.company_id || config.params?.companyId || /[?&](company_id|companyId)=/.test(config.url || '');
        if (!hasCompanyIdParam) {
          config.headers['X-Company-Id'] = companyId;
          config.params = {
            ...config.params,
            company_id: companyId
          };
        }
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

// ====================================================================
// FEATURE FLAGS API
// ====================================================================

/**
 * Get all feature flags (admin only)
 */
export const getFeatureFlags = async () => {
  const response = await api.get('/feature-flags');
  return response.data;
};

/**
 * Update feature flags (admin only)
 */
export const updateFeatureFlags = async (flags) => {
  const response = await api.put('/feature-flags', { flags });
  return response.data;
};

/**
 * Check if a specific feature flag is enabled
 */
export const checkFeatureFlag = async (flagName) => {
  const response = await api.get(`/feature-flags/${flagName}`);
  return response.data;
};

export default api;