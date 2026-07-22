/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext.jsx';
import { normalizeVoucherPayload } from '../utils/accountingRules.js';

// 1. Khởi tạo Context cho Business Logic Only
const VoucherContext = createContext(null);

// 2. Hook cung cấp Business Logic Functions (không còn state management)
export function useVoucherLogic() {
  const { activeCompany, checkOpeningBalanceStatus, hasOpeningBalance } = useAuth();

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
      if (type !== 'DR' && type !== 'CR') {
        return { isValid: false, error: `Dòng định khoản ${accountCode} thiếu hướng Nợ/Có.` };
      }

      if (type === 'DR') totalDr += amount;
      if (type === 'CR') totalCr += amount;
    }

    if (Math.abs(totalDr - totalCr) > 0.01) {
      return {
        isValid: false,
        error: `Chứng từ mất cân đối kế toán! Tổng Nợ (${totalDr.toLocaleString('vi-VN')} đ) phải bằng Tổng Có (${totalCr.toLocaleString('vi-VN')} đ). Lệch: ${Math.abs(totalDr - totalCr).toLocaleString('vi-VN')} đ.`
      };
    }

    return { isValid: true };
  };

  const validateVoucherData = (data) => {
    // Kiểm tra số dư đầu kỳ
    if (hasOpeningBalance === false && activeCompany?.id) {
      return {
        valid: false,
        error: 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.'
      };
    }

    const voucherData = normalizeVoucherPayload(data || {}, activeCompany);
    const checkBalance = validateDoubleEntry(voucherData.details);
    
    if (!checkBalance.isValid) {
      return { valid: false, error: checkBalance.error };
    }

    if (!voucherData.company_id) {
      return { valid: false, error: 'Vui lòng chọn doanh nghiệp trước khi ghi sổ.' };
    }

    return { valid: true, data: voucherData };
  };

  const fetchCashFlow = async (companyId, year, method = 'indirect') => {
    try {
      const cid = companyId ?? activeCompany?.id ?? activeCompany;
      if (!cid) return null;
      const params = new URLSearchParams({ company_id: cid });
      if (year) params.append('year', year);
      params.append('method', method);
      const res = await api.get(`/cashflow?${params.toString()}`);
      return res.data?.data ?? res.data ?? null;
    } catch (err) {
      console.error('Lỗi tải báo cáo dòng tiền:', err);
      return null;
    }
  };

  return {
    validateDoubleEntry,
    validateVoucherData,
    fetchCashFlow,
    activeCompany,
    hasOpeningBalance
  };
}

// 3. Custom Hook để sử dụng Business Logic
function useVoucherLogicContext() {
  const context = useContext(VoucherContext);
  if (!context) {
    throw new Error('useVoucherLogicContext phải được lồng bên trong cấu trúc của VoucherProvider');
  }
  return context;
}

// 4. Provider (chỉ cung cấp logic, không quản lý state)
export function VoucherProvider({ children }) {
  const logic = useVoucherLogic();
  
  return (
    <VoucherContext.Provider value={logic}>
      {children}
    </VoucherContext.Provider>
  );
}

// Export tập trung theo chuẩn Vite
export { useVoucherLogicContext as useVouchers };
