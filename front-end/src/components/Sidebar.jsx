import React from 'react';
import { NavLink } from 'react-router-dom'; // 👈 Import NavLink để xử lý chuyển hướng URL
import { useAuth } from '../context/AuthContext.jsx';
import { MODULES_REGISTER } from '../views/index.js';
import { Terminal } from 'lucide-react';

export default function Sidebar({ mobileOpen, onRequestClose }) {
  const { user } = useAuth();

  // Bộ lọc phân hệ hiển thị trên thanh Menu bên trái
  const accessibleModules = MODULES_REGISTER.filter(module => {
    // 1. Chặn bảo mật cứng cho cả phân hệ 'config' cũ và phân hệ 'users' mới (Nếu không phải admin thì ẩn luôn)
    if ((module.id === 'config' || module.id === 'users') && user?.role !== 'admin') {
      return false;
    }
    
    // 2. Các phân hệ khác sẽ kiểm tra danh sách vai trò allowedRoles được cấu hình sẵn trong views/index.js
    return module.allowedRoles && module.allowedRoles.includes(user?.role);
  });

  // Hàm helper để render class CSS động dựa trên trạng thái kích hoạt của URL
  const getNavLinkClass = ({ isActive }) => {
    return `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
      isActive 
        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`;
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-400 border-r border-slate-800 flex-col h-full shrink-0">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800 bg-slate-950">
          <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
            <Terminal size={18} />
          </div>
          <div>
            <span className="text-sm font-black text-white tracking-wider">KETOAN ERP</span>
            <span className="text-[9px] block text-emerald-500 font-bold tracking-widest uppercase -mt-0.5">TT200 Standard</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Phân hệ nghiệp vụ</div>
          {accessibleModules.map(mod => {
            const Icon = mod.icon;
            // Giả định đường dẫn URL tương ứng với module.id (Ví dụ: id 'cash' -> path '/cash')
            const targetPath = `/${mod.id}`;

            return (
              <NavLink
                key={mod.id}
                to={targetPath}
                className={getNavLinkClass}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                    <span>{mod.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 text-center text-[10px] text-slate-600 font-medium">
          Hệ thống lõi kế toán doanh nghiệp v1.0
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={onRequestClose} />
          <div className="relative w-64 bg-slate-900 text-slate-400 border-r border-slate-800 flex flex-col h-full">
            <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-800 bg-slate-950">
              <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <Terminal size={18} />
              </div>
              <div>
                <span className="text-sm font-black text-white tracking-wider">KETOAN ERP</span>
                <span className="text-[9px] block text-emerald-500 font-bold tracking-widest uppercase -mt-0.5">TT200</span>
              </div>
              <button className="ml-auto mr-1 p-2" onClick={onRequestClose} aria-label="Close menu">
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Phân hệ nghiệp vụ</div>
              {accessibleModules.map(mod => {
                const Icon = mod.icon;
                const targetPath = `/${mod.id}`;

                return (
                  <NavLink
                    key={mod.id}
                    to={targetPath}
                    onClick={onRequestClose} // Tự động đóng menu mobile sau khi bấm chọn
                    className={getNavLinkClass}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                        <span>{mod.name}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 text-center text-[10px] text-slate-600 font-medium">
              Hệ thống lõi kế toán doanh nghiệp v1.0
            </div>
          </div>
        </div>
      )}
    </>
  );
}

//  