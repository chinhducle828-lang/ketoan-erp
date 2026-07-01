import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ (Không export trực tiếp dòng này)
const VoucherContext = createContext(null);

// 2. Định nghĩa Component Provider (Viết hoa chữ cái đầu)
export function VoucherProvider({ children }) {
  const { activeCompany, checkOpeningBalanceStatus, hasOpeningBalance, openingBalanceMessage } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [blockedByOpeningBalance, setBlockedByOpeningBalance] = useState(false);

  // Kiểm tra số dư đầu kỳ khi chuyển công ty
  useEffect(() => {
    if (activeCompany?.id) {
      checkOpeningBalanceStatus(activeCompany.id);
      setBlockedByOpeningBalance(false);
    }
  }, [activeCompany?.id, checkOpeningBalanceStatus]);

  useEffect(() => {
    if (activeCompany) {
      loadVouchers();
    } else {
      setVouchers([]);
    }
  }, [activeCompany]);

  const loadVouchers = async () => {
    setIsSyncing(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.get(`/api/vouchers?company_id=${companyId}`);
      setVouchers(res.data);
    } catch (err) {
      console.error('Lỗi tải danh sách chứng từ:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const createNewVoucher = async (data) => {
    // Kiểm tra xem đã nhập số dư đầu kỳ chưa
    if (hasOpeningBalance === false && activeCompany?.id) {
      return { 
        success: false, 
        error: 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.' 
      };
    }

    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.post('/api/vouchers', { ...data, companyId });
      if (res.data.success) {
        setVouchers(prev => [res.data.voucher, ...prev]);
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  const removeVoucher = async (id) => {
    try {
      const res = await api.delete(`/api/vouchers/${id}`);
      if (res.data.success) {
        setVouchers(prev => prev.filter(v => v.id !== id));
        return { success: true, message: res.data.message };
      }
    } catch (err) {
      console.error('Lỗi xóa chứng từ:', err);
      // Trả về thông báo lỗi chi tiết từ Backend (Ví dụ: "Bạn không có quyền thực hiện...")
      return { 
        success: false, 
        error: err.response?.data?.error || err.message || 'Lỗi không thể xóa chứng từ' 
      };
    }
  };

  return (
    <VoucherContext.Provider value={{ vouchers, isSyncing, createNewVoucher, removeVoucher, reloadVouchers: loadVouchers }}>
      {children}
    </VoucherContext.Provider>
  );
}

// 3. Khởi tạo Custom Hook nội bộ
function useVouchers() {
  const context = useContext(VoucherContext);
  if (!context) {
    throw new Error('useVouchers phải được lồng bên trong cấu trúc của VoucherProvider');
  }
  return context;
}

// ==========================================
// BẮT BUỘC CHO VITE: Export tập trung tất cả hook thuần ở cuối file
// ==========================================
export { useVouchers };
// ========================================== 