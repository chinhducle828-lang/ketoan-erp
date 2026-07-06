import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import api, { setAuthenticating } from './services/api';
import { canAccessStorefront } from './hooks/usePermissions';
import { XCircle, AlertTriangle } from 'lucide-react';
import { registerServiceWorker, isPushSupported } from './services/pushService';

// Get URL parameters
const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    erp_token: params.get('erp_token'),
    company_id: params.get('company_id'),
    role: params.get('role'),
    erp_url: params.get('erp_url')
  };
};

// Initialize authentication from URL params
// StorefrontPage sẽ xử lý external-login call, main.jsx chỉ lưu params từ URL
const initAuth = async () => {
  const { erp_token, company_id, role, erp_url } = getUrlParams();
  
  if (erp_token) {
    // Set authenticating flag to prevent 401 redirect during initial auth
    setAuthenticating(true);
    try {
      // Chỉ lưu URL params vào localStorage, không gọi API
      // StorefrontPage sẽ gọi external-login qua Effect A
      localStorage.setItem('url_erp_token', erp_token);
      if (company_id) localStorage.setItem('companyId', company_id);
      if (role) localStorage.setItem('userRole', role);
      if (erp_url) localStorage.setItem('erpUrl', erp_url);
      
      return true;
    } finally {
      // Clear authenticating flag
      setAuthenticating(false);
    }
  }
  
  return false;
};

// Unauthorized access component
function UnauthorizedAccess({ userRole }) {
  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Quản trị viên',
      ktt: 'Kế toán trưởng',
      nv: 'Nhân viên',
      nv_banhang: 'Nhân viên bán hàng',
      nv_kho: 'Nhân viên kho'
    };
    return labels[role] || role;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Truy cập bị từ chối</h2>
        <p className="text-sm text-slate-600 mb-4">
          Tài khoản của bạn ({getRoleLabel(userRole)}) không có quyền truy cập cửa hàng.
        </p>
        <p className="text-xs text-slate-500 mb-4">
          Chỉ có nhân viên bán hàng (nv_banhang) và nhân viên kho (nv_kho) mới có thể truy cập trang này.
        </p>
        <button 
          onClick={() => {
            localStorage.clear();
            const erpUrl = localStorage.getItem('erpUrl') || 'https://ketoanonline.up.railway.app';
            window.location.href = erpUrl;
          }}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm"
        >
          Quay lại hệ thống ERP
        </button>
      </div>
    </div>
  );
}

// Main App wrapper with auth initialization
function Root() {
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initAuth();
        // Get the user role after auth initialization
        const role = localStorage.getItem('userRole');
        setUserRole(role);
      } catch (error) {
        setAuthError(error.message);
      } finally {
        setAuthInitialized(true);
      }
    };
    
    initialize();
  }, []);

  // Register service worker for push notifications on app load
  useEffect(() => {
    if (isPushSupported()) {
      registerServiceWorker().catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  if (!authInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Đang khởi tạo phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-6 bg-white rounded-xl shadow-sm max-w-md">
          <p className="text-sm text-rose-600 mb-4">Lỗi xác thực: {authError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Check if user has permission to access storefront
  if (userRole && !canAccessStorefront(userRole)) {
    return <UnauthorizedAccess userRole={userRole} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);