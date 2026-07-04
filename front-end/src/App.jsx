import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { MODULES_REGISTER } from './views/index.js';

// Import các trang Auth
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import ChangePassword from './views/auth/ChangePassword.jsx';
import StorefrontAccessNotice from './views/auth/StorefrontAccessNotice.jsx';

// Import Layout các phân hệ
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';

// Import Wrapper bảo vệ phân hệ (Thay thế vai trò MainContent cũ)
import CompanyRouteWrapper from './components/CompanyRouteWrapper.jsx';

export default function App() {
  // ✅ ĐÃ HOÀN THIỆN: Lấy loading từ useAuth để kiểm soát render bảo vệ tuyến đường
  const { user, token, mustChangePassword, loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Load sidebar state from localStorage
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isFirstRun, setIsFirstRun] = useState(false);
  const roleCode = user?.roleId || user?.role;
  const isStorefrontOnlyRole = roleCode === 'nv_banhang' || roleCode === 'nv_kho';
  const defaultModule = MODULES_REGISTER.find((module) => module.allowedRoles?.includes(roleCode));
  const defaultPath = defaultModule ? `/${defaultModule.id}` : '/login';

  // ✅ ĐÃ HOÀN THIỆN: Màn hình chờ đồng bộ an toàn khi F5 ứng dụng
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-3">
        <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-semibold tracking-wide animate-pulse">
          Đang đồng bộ chuỗi phiên an toàn...
        </span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ==========================================
            1. CÁC ĐƯỜNG DẪN XÁC THỰC (AUTH ROUTES)
           ========================================== */}
        <Route 
          path="/login" 
          element={
            !token || isStorefrontOnlyRole ? (
              isFirstRun ? <Register onSwitch={() => setIsFirstRun(false)} /> : <Login onFirstRun={() => setIsFirstRun(true)} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/change-password" 
          element={token && mustChangePassword ? <ChangePassword /> : <Navigate to="/" replace />} 
        />

        {/* ==========================================
            2. CÁC ĐƯỜNG DẪN PHÂN HỆ CHÍNH (PROTECTED ERP ROUTES)
           ========================================== */}
        <Route
          path="/*"
          element={
            !token ? (
              <Navigate to="/login" replace />
            ) : mustChangePassword ? (
              <Navigate to="/change-password" replace />
            ) : isStorefrontOnlyRole ? (
              <StorefrontAccessNotice />
            ) : (
              // Giao diện Layout tổng thể sau khi Login thành công
              <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar 
                  mobileOpen={mobileSidebarOpen} 
                  onRequestClose={() => setMobileSidebarOpen(false)}
                  isOpen={sidebarOpen}
                  onToggle={() => {
                    const newState = !sidebarOpen;
                    setSidebarOpen(newState);
                    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
                  }}
                />
                
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                  <Header 
                    onMenuClick={() => setMobileSidebarOpen(open => !open)}
                    onToggleSidebar={() => setSidebarOpen(open => !open)}
                  />
                  
                  <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <Routes>
                      {/* Trang chủ mặc định nhảy vào Khai báo số dư */}
                      <Route path="/" element={<Navigate to={defaultPath} replace />} />
                      
                      {/* 🚀 TỰ ĐỘNG KHAI BÁO TUYẾN ĐƯỜNG (DYNAMIC ROUTING) */}
                      {MODULES_REGISTER.map(mod => (
                        <Route
                          key={mod.id}
                          path={`/${mod.id}`}
                          element={
                            <CompanyRouteWrapper 
                              component={mod.component} 
                              requiresActiveCompany={mod.requiresActiveCompany}
                              moduleId={mod.id}
                            />
                          }
                        />
                      ))}

                      {/* Bắt các URL gõ sai quay về trang chủ */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}