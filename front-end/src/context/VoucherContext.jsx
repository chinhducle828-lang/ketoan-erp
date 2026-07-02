import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ (Không export trực tiếp dòng này)
const VoucherContext = createContext(null);

// 2. Định nghĩa Component Provider
export function VoucherProvider({ children }) {
  const { activeCompany, checkOpeningBalanceStatus, hasOpeningBalance } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Trích xuất ID nguyên bản của doanh nghiệp an toàn (Luôn ép về kiểu Number)
  const getCurrentCompanyId = () => {
    if (!activeCompany) return null;
    return typeof activeCompany === 'object' ? Number(activeCompany.id) : Number(activeCompany);
  };

  // Kiểm tra số dư đầu kỳ khi chuyển đổi doanh nghiệp
  useEffect(() => {
    const companyId = getCurrentCompanyId();
    if (companyId) {
      checkOpeningBalanceStatus(companyId);
    }
  }, [activeCompany, checkOpeningBalanceStatus]);

  // Tải lại toàn bộ danh sách chứng từ tương ứng khi đổi công ty
  useEffect(() => {
    const companyId = getCurrentCompanyId();
    if (companyId) {
      loadVouchers();
    } else {
      setVouchers([]);
    }
  }, [activeCompany]);

  const loadVouchers = async () => {
    const companyId = getCurrentCompanyId();
    if (!companyId) return;

    setIsSyncing(true);
    try {
      const res = await api.get(`/api/vouchers?company_id=${companyId}`);
      setVouchers(res.data);
    } catch (err) {
      console.error('Lỗi tải danh sách chứng từ:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const createNewVoucher = async (data) => {
    const companyId = getCurrentCompanyId();

    // CHẶN NGHIỆP VỤ: Nếu doanh nghiệp chưa khai báo số dư đầu kỳ
    if (hasOpeningBalance === false && companyId) {
      return { 
        success: false, 
        error: 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.' 
      };
    }

    try {
      // Đảm bảo dữ liệu companyId truyền lên Backend luôn luôn là kiểu Number nguyên bản
      const payload = { 
        ...data, 
        companyId: data.companyId ? Number(data.companyId) : companyId 
      };

      const res = await api.post('/api/post/vouchers', payload);
      
      if (res.data.success) {
        // Cập nhật State để UI hiển thị chứng từ mới ngay lập tức mà không cần F5
        setVouchers(prev => [res.data.voucher || res.data, ...prev]);
        return { success: true };
      }
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || err.message || 'Lỗi không thể tạo chứng từ mới' 
      };
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