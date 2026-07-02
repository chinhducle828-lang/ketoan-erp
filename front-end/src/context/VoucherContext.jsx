import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ
const VoucherContext = createContext(null);

// 2. Định nghĩa Component Provider
export function VoucherProvider({ children }) {
  const { activeCompany, checkOpeningBalanceStatus, hasOpeningBalance } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Kiểm tra số dư đầu kỳ khi chuyển đổi công ty
  useEffect(() => {
    if (activeCompany?.id) {
      checkOpeningBalanceStatus(activeCompany.id);
    }
  }, [activeCompany?.id, checkOpeningBalanceStatus]);

  // Tự động tải lại danh sách chứng từ khi thay đổi pháp nhân hạch toán
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
      if (!companyId) return;
      
      const res = await api.get(`/api/vouchers?company_id=${companyId}`);
      // Bảo vệ State: Đảm bảo dữ liệu nhận về luôn là mảng để không lỗi hàm render (.map)
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Lỗi tải danh sách chứng từ:', err);
      setVouchers([]);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * 🛠️ HÀM NGHIỆP VỤ: ĐỐI CHIẾU CHÉO ĐỊNH KHOẢN (DOUBLE-ENTRY VALIDATION)
   * Đảm bảo tổng tiền phát sinh bên Nợ luôn luôn bằng tổng tiền phát sinh bên Có trước khi lưu
   */
  const validateDoubleEntry = (details) => {
    if (!details || !Array.isArray(details) || details.length === 0) {
      return { isValid: false, error: 'Chứng từ rỗng! Cần có ít nhất một cặp tài khoản định khoản Nợ/Có.' };
    }

    let totalDr = 0;
    let totalCr = 0;

    for (const entry of details) {
      const amount = parseFloat(entry.amount || 0);
      const accountCode = entry.accountCode || entry.account_code;
      const type = entry.entryType || entry.entry_type;

      if (!accountCode) {
        return { isValid: false, error: 'Phát hiện dòng định khoản chưa chọn Mã tài khoản!' };
      }
      if (amount <= 0) {
        return { isValid: false, error: `Số tiền tại tài khoản ${accountCode} phải lớn hơn 0!` };
      }

      if (type === 'DR') totalDr += amount;
      if (type === 'CR') totalCr += amount;
    }

    // Đối chiếu chéo logic toán học kế toán
    if (Math.abs(totalDr - totalCr) > 0.01) { // Sử dụng sai số nhỏ để tránh lỗi số thực float
      return {
        isValid: false,
        error: `Chứng từ mất cân đối kế toán! Tổng Nợ (${totalDr.toLocaleString('vi-VN')} đ) phải bằng Tổng Có (${totalCr.toLocaleString('vi-VN')} đ). Lệch: ${Math.abs(totalDr - totalCr).toLocaleString('vi-VN')} đ.`
      };
    }

    return { isValid: true };
  };

  const createNewVoucher = async (data) => {
    // CHỐT CHẶN 1: Bắt buộc khai báo số dư đầu kỳ trước khi phát sinh nghiệp vụ
    if (hasOpeningBalance === false && activeCompany?.id) {
      return { 
        success: false, 
        error: 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.' 
      };
    }

    // Phòng chống lỗi gửi payload null làm sập backend
    const voucherData = data || {};

    // CHỐT CHẶN 2: Kích hoạt bộ lọc đối chiếu chéo Nợ - Có thời gian thực
    const checkBalance = validateDoubleEntry(voucherData.details);
    if (!checkBalance.isValid) {
      return { success: false, error: checkBalance.error };
    }

    try {
      const companyId = activeCompany?.id ?? activeCompany;
      
      // Đóng gói JSON an toàn, thay thế toàn bộ tham số null tiềm ẩn bằng object rỗng {}
      const res = await api.post('/api/vouchers', { 
        ...voucherData, 
        companyId,
        details: voucherData.details || [] 
      });

      if (res.data?.success) {
        setVouchers(prev => [res.data.voucher, ...prev]);
        return { success: true };
      }
      return { success: false, error: res.data?.message || 'Không thể tạo chứng từ.' };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.response?.data?.message || err.message };
    }
  };

  const removeVoucher = async (id) => {
    if (!id) return { success: false, error: 'Mã định danh chứng từ không hợp lệ.' };
    try {
      const res = await api.delete(`/api/vouchers/${id}`);
      if (res.data?.success) {
        setVouchers(prev => prev.filter(v => v.id !== id));
        return { success: true, message: res.data.message };
      }
      return { success: false, error: res.data?.message || 'Xóa chứng từ thất bại.' };
    } catch (err) {
      console.error('Lỗi xóa chứng từ:', err);
      return { 
        success: false, 
        error: err.response?.data?.error || err.response?.data?.message || err.message || 'Lỗi không thể xóa chứng từ' 
      };
    }
  };

  return (
    <VoucherContext.Provider value={{ vouchers, isSyncing, createNewVoucher, removeVoucher, reloadVouchers: loadVouchers }}>
      {children}
    </VoucherContext.Provider>
  );
}

// 3. Custom Hook nội bộ
function useVouchers() {
  const context = useContext(VoucherContext);
  if (!context) {
    throw new Error('useVouchers phải được lồng bên trong cấu trúc của VoucherProvider');
  }
  return context;
}

// Export tập trung theo chuẩn Vite
export { useVouchers };
