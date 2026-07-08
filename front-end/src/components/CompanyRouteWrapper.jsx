/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { Suspense, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import { MODULES_REGISTER } from '../views/index.js';

export default function CompanyRouteWrapper({ component: Component, requiresActiveCompany, moduleId }) {
  const { user, activeCompany, hasOpeningBalance, checkOpeningBalanceStatus } = useAuth();
  const currentModule = MODULES_REGISTER.find((module) => module.id === moduleId);

  if (!currentModule || !currentModule.allowedRoles?.includes(user?.role)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-lg mx-auto mt-12 animate-fade-in">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl mb-4 border border-rose-100">
          <Lock size={32} />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Không có quyền truy cập</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          Tài khoản hiện tại không được phân quyền cho phân hệ này. Vui lòng liên hệ quản trị để cấp quyền đúng vai trò nghiệp vụ.
        </p>
      </div>
    );
  }

  // Kiểm tra trạng thái số dư đầu kỳ khi thay đổi công ty
  useEffect(() => {
    if (activeCompany?.id && moduleId !== 'opening') {
      checkOpeningBalanceStatus(activeCompany.id);
    }
  }, [activeCompany?.id, moduleId, checkOpeningBalanceStatus]);

  // Kiểm tra nếu phân hệ yêu cầu công ty mà người dùng chưa chọn pháp nhân
  if (requiresActiveCompany && !activeCompany?.id) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-lg mx-auto mt-12 animate-fade-in">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mb-4 border border-amber-100">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Chưa chọn pháp nhân hạch toán</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          Vui lòng chọn doanh nghiệp cần ghi sổ, hạch toán báo cáo ở thanh công cụ phía trên đỉnh màn hình để mở khóa dữ liệu phân hệ này.
        </p>
      </div>
    );
  }

  // Kiểm tra nếu chưa khai báo số dư đầu kỳ và không phải trang opening
  if (requiresActiveCompany && activeCompany?.id && moduleId !== 'opening' && !hasOpeningBalance) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-rose-200 rounded-2xl shadow-sm max-w-lg mx-auto mt-12 animate-fade-in">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl mb-4 border border-rose-100">
          <Lock size={32} />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Chưa khai báo số dư đầu kỳ</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
          Bạn cần khai báo số dư đầu kỳ trước khi sử dụng các phân hệ hạch toán khác. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập liệu.
        </p>
        <a 
          href="/opening" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition shadow-sm"
        >
          Đi đến khai báo số dư đầu kỳ
        </a>
      </div>
    );
  }

  // Nếu hợp lệ, render component đó trong Suspense mượt mà
  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <RefreshCw className="animate-spin text-emerald-600" size={16} />
        <span>Đang nạp dữ liệu phân hệ hạch toán...</span>
      </div>
    }>
      <Component />
    </Suspense>
  );
}
