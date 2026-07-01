import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { MODULES_REGISTER } from './views/index.js'; // 👈 Import danh mục 12 phân hệ

// Import các trang Auth
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import ChangePassword from './views/auth/ChangePassword.jsx';

// Import Layout các phân hệ
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';

// Import Wrapper bảo vệ phân hệ (Thay thế vai trò MainContent cũ)
import CompanyRouteWrapper from './components/CompanyRouteWrapper.jsx';

export default function App() {
  const { token, mustChangePassword } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        {/* ==========================================
            1. CÁC ĐƯỜNG DẪN XÁC THỰC (AUTH ROUTES)
           ========================================== */}
        <Route 
          path="/login" 
          element={
            !token ? (
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
            ) : (
              // Giao diện Layout tổng thể sau khi Login thành công
              <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar mobileOpen={mobileSidebarOpen} onRequestClose={() => setMobileSidebarOpen(false)} />
                
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                  <Header onMenuClick={() => setMobileSidebarOpen(open => !open)} />
                  
                  <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <Routes>
                      {/* Trang chủ mặc định nhảy vào Khai báo số dư */}
                      <Route path="/" element={<Navigate to="/opening" replace />} />
                      
                      {/* 🚀 TỰ ĐỘNG KHAI BÁO TUYẾN ĐƯỜNG (DYNAMIC ROUTING) */}
                      {MODULES_REGISTER.map(mod => (
                        <Route
                          key={mod.id}
                          path={`/${mod.id}`}
                          element={
                            <CompanyRouteWrapper 
                              component={mod.component} 
                              requiresActiveCompany={mod.requiresActiveCompany} 
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