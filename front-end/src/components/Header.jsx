import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Building2, LogOut, User, Calendar } from 'lucide-react';

export default function Header({ onMenuClick }) {
  // Lấy dữ liệu đồng bộ cấu trúc Object từ AuthContext
  const { user, companies, activeCompany, changeCompany, logout, fiscalYear, setFiscalYear } = useAuth();

  // Danh sách niên độ kế toán hỗ trợ trong hệ thống
  const availableYears = [2024, 2025, 2026, 2027, 2028];

  // Xử lý chuyển đổi công ty an toàn bằng cách tìm và truyền Object
  const handleCompanyChange = (e) => {
    const selectedId = Number(e.target.value);
    const targetCompObj = companies.find(c => c.id === selectedId);
    if (targetCompObj) {
      changeCompany(targetCompObj);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 md:h-16 h-auto flex flex-col md:flex-row items-center justify-between px-4 md:px-6 z-10 shrink-0 py-3 md:py-0">
      {/* Mobile menu button */}
      <button
        className="md:hidden p-2 mr-2 rounded-lg hover:bg-slate-100"
        aria-label="Open menu"
        onClick={() => typeof onMenuClick === 'function' && onMenuClick()}
      >
        <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      <div className="flex items-center gap-4 w-full md:w-auto">
        {/* Bộ chọn doanh nghiệp hạch toán (ĐỒNG BỘ THEO ID CỦA OBJECT ACTIVE) */}
        <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold w-full md:w-auto">
          <Building2 size={16} className="text-emerald-600" />
          <select 
            value={activeCompany?.id || ''} 
            onChange={handleCompanyChange}
            className="bg-transparent border-none focus:outline-none font-bold text-slate-800 w-full cursor-pointer"
            disabled={user?.role !== 'admin' && user?.role !== 'ktt'}
          >
            <option value="" disabled>-- Chọn doanh nghiệp hạch toán --</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.tax_code})</option>
            ))}
          </select>
        </div>
        
        {/* Bộ chọn Niên độ kế toán động */}
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-slate-600">Niên độ kế toán:</span>
          <select
            value={fiscalYear || 2026}
            onChange={(e) => setFiscalYear && setFiscalYear(Number(e.target.value))}
            className="bg-transparent border-none focus:outline-none font-bold text-slate-800 cursor-pointer pl-1"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Khối thông tin tài khoản và Đăng xuất */}
      <div className="flex items-center gap-4 mt-3 md:mt-0 md:ml-2">
        <div className="flex items-center gap-2 text-right">
          <div>
            <div className="text-xs font-bold text-slate-800">{user?.username}</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {user?.role === 'admin' ? 'Quản trị tối cao' : user?.role === 'ktt' ? 'Kế toán trưởng' : 'Kế toán viên'}
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">
            <User size={16} />
          </div>
        </div>

        <button 
          onClick={logout}
          className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-transparent hover:border-rose-200"
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
} 

  