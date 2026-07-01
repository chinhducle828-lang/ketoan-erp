import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { CHART_OF_ACCOUNTS } from '../../utils/constants.js';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';
import { Coins, Save, Loader2, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function OpeningBalances() {
  const { activeCompany } = useAuth();
  const companyIdStr = activeCompany?.id ?? activeCompany ?? 'default';
  const [balances, setBalances] = usePersistentState(`opening-balances-form-${companyIdStr}`, {});
  
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimerRef = useRef(null);
  
  const balancesRef = useRef(balances);
  useEffect(() => {
    balancesRef.current = balances;
  }, [balances]);

  // 1. Tải số dư đầu kỳ khi chuyển đổi doanh nghiệp
  useEffect(() => {
    if (activeCompany) {
      loadOpeningBalances();
    } else {
      setBalances({});
    }
  }, [activeCompany]);

  const loadOpeningBalances = async () => {
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.get(`/api/opening-balances?company_id=${companyId}&year=2026`);
      const initial = {};
      res.data.forEach(b => {
        const code = b.accountCode || b.account_code;
        const dr = b.debitBalance || b.debit_balance;
        const cr = b.creditBalance || b.credit_balance;
        
        initial[code] = { 
          dr: parseFloat(dr) || 0, 
          cr: parseFloat(cr) || 0 
        };
      });
      setBalances(initial);
    } catch (err) { 
      console.error('Không thể lấy số dư đầu kỳ:', err); 
    }
  };

  // 2. Tính toán động Tổng Nợ / Tổng Có đầu kỳ thời gian thực (Real-time)
  const totalDr = CHART_OF_ACCOUNTS.reduce((sum, acc) => sum + (parseFloat(balances[acc.code]?.dr) || 0), 0);
  const totalCr = CHART_OF_ACCOUNTS.reduce((sum, acc) => sum + (parseFloat(balances[acc.code]?.cr) || 0), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.5;

  // 3. Xử lý thay đổi input: Ép kiểu dữ liệu về số hoặc giữ trống thông minh
  const handleInputChange = (code, field, val) => {
    const numericValue = val === '' ? 0 : parseFloat(val);
    setBalances(prev => ({
      ...prev,
      [code]: { 
        ...(prev[code] || { dr: 0, cr: 0 }), 
        [field]: numericValue 
      }
    }));
  };

  // 4. Hàm lưu thủ công kèm kiểm tra cân đối tài khoản
  const handleSave = async () => {
    if (!isBalanced) {
      alert(`❌ Không thể lưu số dư đầu kỳ!\nTổng Nợ (${totalDr.toLocaleString()} đ) đang lệch so với Tổng Có (${totalCr.toLocaleString()} đ).\nVui lòng kiểm tra và điều chỉnh lại bảng cân đối tài khoản.`);
      return;
    }

    setSaving(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.post('/api/opening-balances', { 
        companyId, 
        balances: balancesRef.current,
        year: 2026
      });
      if (res.data?.success) {
        setLastSavedAt(new Date().toISOString());
        alert('Lưu bảng cân đối số dư đầu kỳ thành công!');
      }
    } catch (err) { 
      alert(err.response?.data?.error || 'Lỗi hệ thống khi lưu số dư!'); 
    } finally {
      setSaving(false);
    }
  };

  // 5. Hàm xóa hết làm lại (Reset) dữ liệu tạm thời
  const handleResetBalances = () => {
    const confirmReset = window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA SẠCH?\nHành động này sẽ đưa toàn bộ số dư đang nhập trên màn hình và LocalStorage về 0. Bạn sẽ phải nhập lại từ đầu.");
    if (confirmReset) {
      setBalances({});
    }
  };

  // 6. Cơ chế Auto-save (Chỉ lưu tự động khi hai vế đã thực sự cân bằng)
  useEffect(() => {
    if (!activeCompany || Object.keys(balances).length === 0) return;
    if (!isBalanced) return; // Nếu đang lệch thì không kích hoạt auto-save tránh đẩy rác lên DB

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        const companyId = activeCompany?.id ?? activeCompany;
        const res = await api.post('/api/opening-balances', { 
          companyId, 
          balances: balancesRef.current,
          year: 2026
        });
        if (res.data?.success) {
          setLastSavedAt(new Date().toISOString());
        }
      } catch (err) {
        console.error('Auto-save số dư đầu kỳ thất bại:', err);
      } finally {
        setSaving(false);
      }
    }, 2500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [balances, activeCompany, isBalanced]);

  // 7. Đồng bộ cưỡng bức dữ liệu khi người dùng đóng tab đột ngột (Chỉ chạy khi cân đối)
  useEffect(() => {
    const handler = () => {
      if (!activeCompany || Object.keys(balancesRef.current).length === 0) return;
      
      const currentDr = CHART_OF_ACCOUNTS.reduce((sum, acc) => sum + (parseFloat(balancesRef.current[acc.code]?.dr) || 0), 0);
      const currentCr = CHART_OF_ACCOUNTS.reduce((sum, acc) => sum + (parseFloat(balancesRef.current[acc.code]?.cr) || 0), 0);
      if (Math.abs(currentDr - currentCr) > 0.5) return; 

      try {
        const companyId = activeCompany?.id ?? activeCompany;
        const token = localStorage.getItem('token');
        fetch('/api/opening-balances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ companyId, balances: balancesRef.current, year: 2026 }),
          keepalive: true
        });
      } catch (e) {
        console.error('Failed to flush opening balances on unload', e);
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeCompany]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Coins className="text-amber-500" size={24} /> 
          KHAI BÁO SỐ DƯ ĐẦU KỲ HỆ THỐNG TÀI KHOẢN TT200
        </h1>
        <div className="flex items-center gap-2">
          <ExportExcelButton endpoint="opening-balances" filename="So_Du_Dau_Ky" label="Xuất Excel" />
          <ImportExcelButton endpoint="opening-balances" filename="So_Du_Dau_Ky" label="Nhập Excel" />
          
          {/* NÚT XÓA HẾT LÀM LẠI MỚI THÊM */}
          <button 
            onClick={handleResetBalances}
            type="button"
            className="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Trash2 size={14} />
            Xóa hết làm lại
          </button>

          <button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Lưu số dư đầu kỳ
          </button>
        </div>
      </div>

      {/* BANNER THÔNG BÁO TRẠNG THÁI CÂN ĐỐI TÀI KHOẢN */}
      <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold shadow-sm transition-all duration-300 ${isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
        {isBalanced ? (
          <>
            <CheckCircle className="text-emerald-600 flex-shrink-0" size={20} />
            <div>
              <p className="uppercase text-[11px] tracking-wider">Trạng thái: Bảng cân đối hợp lệ</p>
              <p className="text-slate-500 font-normal mt-0.5">Tổng vế Nợ và vế Có đầu kỳ hoàn toàn khớp nhau. Hệ thống đã mở quyền tự động sao lưu dữ liệu.</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="text-rose-600 flex-shrink-0 animate-bounce" size={20} />
            <div>
              <p className="uppercase text-[11px] tracking-wider">Cảnh báo: Bảng số dư mất cân đối (Lệch: {Math.abs(totalDr - totalCr).toLocaleString()} đ)</p>
              <p className="text-slate-500 font-normal mt-0.5">Tổng Nợ đang khác Tổng Có. Hệ thống tạm dừng tính năng Auto-save để bảo vệ tính chính xác của sổ sách kế toán.</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 font-bold border-b text-slate-500">
                <th className="p-3 w-32">Mã tài khoản</th>
                <th className="p-3">Tên tài khoản thông tư</th>
                <th className="p-3 text-center w-48">Dư Nợ đầu kỳ (VND)</th>
                <th className="p-3 text-center w-48">Dư Có đầu kỳ (VND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Trạng thái lưu dữ liệu */}
              <tr className="bg-slate-50/50">
                <td colSpan={4} className="text-xs p-2.5 text-right font-medium text-slate-500">
                  {saving ? (
                    <span className="text-amber-600 flex items-center justify-end gap-1 font-bold animate-pulse">
                      <Loader2 size={12} className="animate-spin" /> Hệ thống đang tự động đồng bộ số dư...
                    </span>
                  ) : lastSavedAt ? (
                    <span className="text-emerald-600 font-bold">
                      ✓ Đã đồng bộ lên Cloud lúc: {new Date(lastSavedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">Chưa có thay đổi mới</span>
                  )}
                </td>
              </tr>

              {/* Danh sách tài khoản sinh từ danh mục từ điển kế toán */}
              {CHART_OF_ACCOUNTS.map(acc => {
                // KIỂM TRA TÀI KHOẢN DOANH THU/CHI PHÍ ĐẦU 5 ĐẾN 9
                const isReadOnly = ['5', '6', '7', '8', '9'].includes(acc.code[0]);

                return (
                  <tr key={acc.code} className={`hover:bg-slate-50/40 transition ${isReadOnly ? 'bg-slate-100/60 opacity-60' : ''}`}>
                    <td className="p-3 font-mono font-bold text-slate-600">{acc.code}</td>
                    <td className="p-3 text-slate-700 font-semibold">
                      {acc.name} {isReadOnly && <span className="text-[10px] text-slate-400 font-normal italic ml-1">(Không có số dư)</span>}
                    </td>
                    <td className="p-3">
                      <input 
                        type="number" 
                        placeholder={isReadOnly ? "X" : "0"} 
                        disabled={isReadOnly}
                        value={isReadOnly ? '' : (balances[acc.code]?.dr || '')} 
                        onChange={e => handleInputChange(acc.code, 'dr', e.target.value)} 
                        className="w-full p-2 bg-slate-50/80 border rounded-lg font-mono text-right font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition disabled:bg-slate-200/60 disabled:cursor-not-allowed" 
                      />
                    </td>
                    <td className="p-3">
                      <input 
                        type="number" 
                        placeholder={isReadOnly ? "X" : "0"} 
                        disabled={isReadOnly}
                        value={isReadOnly ? '' : (balances[acc.code]?.cr || '')} 
                        onChange={e => handleInputChange(acc.code, 'cr', e.target.value)} 
                        className="w-full p-2 bg-slate-50/80 border rounded-lg font-mono text-right font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition disabled:bg-slate-200/60 disabled:cursor-not-allowed" 
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* CHÈN HÀNG TỔNG CÂN ĐỐI TÀI KHOẢN THEO THÔNG TƯ ĐÚNG TIÊU CHUẨN */}
            <tfoot>
              <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-800 shadow-[inset_0_2px_0_rgba(0,0,0,0.05)]">
                <td className="p-3.5 text-right font-black" colSpan={2}>
                  TỔNG CỘNG CÂN ĐỐI SỐ DƯ ĐẦU KỲ:
                </td>
                <td className={`p-3.5 text-right font-mono text-sm tracking-wide ${isBalanced ? 'text-blue-700' : 'text-rose-600'}`}>
                  {totalDr.toLocaleString()} đ
                </td>
                <td className={`p-3.5 text-right font-mono text-sm tracking-wide ${isBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {totalCr.toLocaleString()} đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}