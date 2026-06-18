import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Building2, LogOut, User, Calendar } from 'lucide-react';

export default function Header() {
  // Bổ sung fiscalYear và setFiscalYear lấy từ AuthContext
  const { user, companies, activeCompany, changeCompany, logout, fiscalYear, setFiscalYear } = useAuth();

  const currentCompany = companies.find(c => c.id === activeCompany);

  // Danh sách niên độ kế toán hỗ trợ trong hệ thống
  const availableYears = [2024, 2025, 2026, 2027, 2028];

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 z-10 shrink-0">
      <div className="flex items-center gap-4">
        {/* Bộ chọn doanh nghiệp hạch toán */}
        <div className="flex items-center gap-2 text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
          <Building2 size={16} className="text-emerald-600" />
          <select 
            value={activeCompany || ''} 
            onChange={(e) => changeCompany(Number(e.target.value))}
            className="bg-transparent border-none focus:outline-none font-bold text-slate-800"
            disabled={user?.role !== 'admin' && user?.role !== 'ktt'}
          >
            <option value="" disabled>-- Chọn doanh nghiệp hạch toán --</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.tax_code})</option>
            ))}
          </select>
        </div>
        
        {/* ĐOẠN ĐÃ SỬA: Bộ chọn Niên độ kế toán động */}
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-slate-600">Niên độ kế toán:</span>
          <select
            value={fiscalYear || 2026} // Fallback về 2026 nếu chưa định nghĩa trong context
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
      <div className="flex items-center gap-4">
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

  // Header.jsx  
  // Đây là component Header của ứng dụng, chứa:
  // - Bộ chọn doanh nghiệp hạch toán (dựa trên danh sách companies và activeCompany từ AuthContext)
  // - Bộ chọn niên độ kế toán động (dựa trên fiscalYear và setFiscalYear từ AuthContext)
  // - Thông tin tài khoản người dùng (username và role)
  // - Nút đăng xuất (gọi hàm logout từ AuthContext)