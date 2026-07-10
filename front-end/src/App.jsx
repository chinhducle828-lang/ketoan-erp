/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { MODULES_REGISTER } from './views/index.js';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PopupNotification from './components/PopupNotification.jsx';

// Import các trang Auth
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import ChangePassword from './views/auth/ChangePassword.jsx';
import StorefrontAccessNotice from './views/auth/StorefrontAccessNotice.jsx';
import CustomerView from './views/auth/CustomerView.jsx';
import { isStorefrontOnlyRole } from './constants/storefrontRoles.js';

// Import Layout các phân hệ
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import ResponsiveContainer from './components/ResponsiveContainer.jsx';
import CompanyRouteWrapper from './components/CompanyRouteWrapper.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  const { user, token, mustChangePassword, loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isFirstRun, setIsFirstRun] = useState(false);
  const roleCode = user?.roleId || user?.role;
  const userNeedsStorefrontOnly = isStorefrontOnlyRole(roleCode);
  const isGiamDocKinhDoanh = roleCode === 'gd_kinhdoanh';
  const defaultModule = MODULES_REGISTER.find((module) => module.allowedRoles?.includes(roleCode));
  // Không bao giờ trỏ về /login để tránh vòng lặp redirect vô hạn (/ <-> /login)
  const defaultPath = defaultModule ? `/${defaultModule.id}` : `/${MODULES_REGISTER[0]?.id || 'dashboard'}`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
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
        <Route 
          path="/login" 
          element={
            !token ? (
              isFirstRun ? <Register onSwitch={() => setIsFirstRun(false)} /> : <Login onFirstRun={() => setIsFirstRun(true)} />
            ) : userNeedsStorefrontOnly ? (
              <Navigate to="/pos" replace />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        {isGiamDocKinhDoanh && (
          <Route 
            path="/gd-kinhdoanh/*" 
            element={
              <div className="flex h-screen bg-slate-50 overflow-hidden">
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                  <main className="flex-1 overflow-y-auto bg-slate-50">
                    <ResponsiveContainer className="py-6">
                      <Routes>
                        <Route path="/" element={<Navigate to="/gd-kinhdoanh/dashboard" replace />} />
                        <Route path="/dashboard" element={<CompanyRouteWrapper component={MODULES_REGISTER.find(m => m.id === 'dashboard').component} requiresActiveCompany={true} moduleId="dashboard" />} />
                        <Route path="/reports" element={<CompanyRouteWrapper component={MODULES_REGISTER.find(m => m.id === 'income-statement').component} requiresActiveCompany={true} moduleId="income-statement" />} />
                        <Route path="/balance-sheet" element={<CompanyRouteWrapper component={MODULES_REGISTER.find(m => m.id === 'balance-sheet').component} requiresActiveCompany={true} moduleId="balance-sheet" />} />
                        <Route path="/cash-flow" element={<CompanyRouteWrapper component={MODULES_REGISTER.find(m => m.id === 'cash-flow').component} requiresActiveCompany={true} moduleId="cash-flow" />} />
                      </Routes>
                    </ResponsiveContainer>
                  </main>
                  <Footer />
                </div>
              </div>
            }
          />
        )}
        <Route 
          path="/change-password" 
          element={token && mustChangePassword ? <ChangePassword /> : <Navigate to="/" replace />} 
        />
        <Route path="/pos" element={<StorefrontAccessNotice />} />
        <Route path="/customer" element={<CustomerView />} />

        <Route
          path="/*"
          element={
            !token ? (
              <Navigate to="/login" replace />
            ) : mustChangePassword ? (
              <Navigate to="/change-password" replace />
            ) : userNeedsStorefrontOnly ? (
              <StorefrontAccessNotice />
            ) : (
              <div className="flex min-h-screen bg-slate-50">
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
                  
                  <main className="flex-1 overflow-y-auto bg-slate-50">
                    <ResponsiveContainer className="py-6">
                      <Routes>
                        <Route path="/" element={<Navigate to={defaultPath} replace />} />
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
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </ResponsiveContainer>
                  </main>
                  <Footer />
                </div>
              </div>
            )
          }
        />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <PopupNotification />
    </BrowserRouter>
  );
}
