import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import ChangePassword from './views/auth/ChangePassword.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import MainContent from './components/MainContent.jsx';

export default function App() {
  const { token, user, mustChangePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('opening');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // 1. Nếu chưa đăng nhập -> Trỏ về luồng Login / Register
  if (!token) {
    if (isFirstRun) {
      return <Register onSwitch={() => setIsFirstRun(false)} />;
    }
    return <Login onFirstRun={() => setIsFirstRun(true)} />;
  }

  // 2. Nếu bắt buộc đổi mật khẩu -> Trỏ về ChangePassword
  if (token && mustChangePassword) {
    return <ChangePassword />;
  }

  // 3. Luồng chạy giao diện chính sau khi đăng nhập thành công
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Thanh menu bên trái */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileSidebarOpen}
        onRequestClose={() => setMobileSidebarOpen(false)}
      />
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Thanh công cụ trên đỉnh */}
        <Header onMenuClick={() => setMobileSidebarOpen(open => !open)} />
        
        {/* Khu vực hiển thị nội dung các phân hệ */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Bây giờ MainContent sẽ tự xử lý tất cả các tab bao gồm cả tab 'users' */}
          <MainContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}