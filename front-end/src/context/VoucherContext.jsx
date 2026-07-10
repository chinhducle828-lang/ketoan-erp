/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../utils/api.js';
import { normalizeVoucherPayload } from '../utils/accountingRules.js';
import { useRealTimeSync } from '../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation.js';

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

  const loadVouchers = useCallback(async () => {
    setIsSyncing(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      if (!companyId) return;
      
      const res = await api.get(`/vouchers?company_id=${companyId}`);
      // Bảo vệ State: Đảm bảo dữ liệu nhận về luôn là mảng để không lỗi hàm render (.map)
      setVouchers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Lỗi tải danh sách chứng từ:', err);
      setVouchers([]);
    } finally {
      setIsSyncing(false);
    }
  }, [activeCompany]);

  // Tự động tải lại danh sách chứng từ khi thay đổi pháp nhân hạch toán
  useEffect(() => {
    if (activeCompany) {
      loadVouchers();
    } else {
      setVouchers([]);
    }
  }, [activeCompany, loadVouchers]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { vouchers: loadVouchers },
    {
      eventMap: {
        'voucher:created': ['vouchers'],
        'voucher:updated': ['vouchers'],
        'voucher:deleted': ['vouchers'],
        'voucher:posted': ['vouchers'],
        voucherCreated: ['vouchers'],
        voucherUpdated: ['vouchers'],
        voucherDeleted: ['vouchers'],
        voucherPosted: ['vouchers'],
        'closing:completed': ['vouchers'],
        closingCompleted: ['vouchers']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(activeCompany) });

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

  const createNewVoucher = async (data) => {
    if (hasOpeningBalance === false && activeCompany?.id) {
      return {
        success: false,
        error: 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.'
      };
    }

    const voucherData = normalizeVoucherPayload(data || {}, activeCompany);
    const checkBalance = validateDoubleEntry(voucherData.details);
    if (!checkBalance.isValid) {
      return { success: false, error: checkBalance.error };
    }

    if (!voucherData.company_id) {
      return { success: false, error: 'Vui lòng chọn doanh nghiệp trước khi ghi sổ.' };
    }

    try {
      const res = await api.post('/vouchers', {
        ...voucherData,
        company_id: voucherData.company_id,
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

  const removeVoucher = async (id) => {
    if (!id) return { success: false, error: 'Mã định danh chứng từ không hợp lệ.' };
    try {
      const res = await api.delete(`/vouchers/${id}`);
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

  /**
   * Post voucher (ghi sổ) - for XK/PT types that require signing
   */
  const postVoucher = async (voucherId, companyId) => {
    if (!voucherId) return { success: false, error: 'Mã chứng từ không hợp lệ.' };
    try {
      const res = await api.post(`/vouchers/${voucherId}/post`, {
        company_id: companyId
      });
      if (res.data?.success) {
        // Update voucher status in local state
        setVouchers(prev => prev.map(v => 
          v.id === voucherId 
            ? { ...v, isPosted: true, postedAt: new Date().toISOString() }
            : v
        ));
        return { success: true, voucher: res.data.voucher };
      }
      return { success: false, error: res.data?.error || res.data?.message || 'Ghi sổ chứng từ thất bại.' };
    } catch (err) {
      // Check if signing is required
      if (err.response?.data?.code === 'SIGNING_REQUIRED') {
        return { 
          success: false, 
          error: err.response?.data?.error,
          requiresSigning: true,
          voucherType: err.response?.data?.voucherType
        };
      }
      return { 
        success: false, 
        error: err.response?.data?.error || err.response?.data?.message || err.message || 'Lỗi không thể ghi sổ chứng từ' 
      };
    }
  };

  return (
    <VoucherContext.Provider value={{ vouchers, isSyncing, createNewVoucher, removeVoucher, postVoucher, reloadVouchers: loadVouchers, fetchVouchers: loadVouchers, fetchCashFlow }}>
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
