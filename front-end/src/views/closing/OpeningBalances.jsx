import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { CHART_OF_ACCOUNTS } from '../../utils/constants.js';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';
import { Coins, Save, Loader2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function OpeningBalances() {
  const { activeCompany } = useAuth();
  // Sử dụng key phân biệt theo từng doanh nghiệp để tránh ghi đè dữ liệu LocalStorage
  const companyIdStr = activeCompany?.id ?? activeCompany ?? 'default';
  const [balances, setBalances] = usePersistentState(`opening-balances-form-${companyIdStr}`, {});
  
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const saveTimerRef = useRef(null);
  
  // Dùng Ref để lưu dữ liệu balances mới nhất giúp Auto-save và Flush-unload đọc trực tiếp, tránh re-trigger useEffect lặp vô hạn
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
        initial[b.account_code] = { 
          dr: parseFloat(b.debit_balance) || 0, 
          cr: parseFloat(b.credit_balance) || 0 
        };
      });
      setBalances(initial);
    } catch (err) { 
      console.error('Không thể lấy số dư đầu kỳ:', err); 
    }
  };

  // 2. Xử lý thay đổi input: Ép kiểu dữ liệu về số hoặc giữ trống thông minh
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

  // 3. Hàm lưu thủ công
  const handleSave = async () => {
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

  // 4. Cơ chế Auto-save (Debounce 2.5 giây sạch sẽ không lo Loop mạng)
  useEffect(() => {
    if (!activeCompany || Object.keys(balances).length === 0) return;

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
  }, [balances, activeCompany]);

  // 5. Đồng bộ cưỡng bức dữ liệu khi người dùng tắt hoặc F5 trình duyệt đột ngột
  useEffect(() => {
    const handler = () => {
      if (!activeCompany || Object.keys(balancesRef.current).length === 0) return;
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
              {CHART_OF_ACCOUNTS.map(acc => (
                <tr key={acc.code} className="hover:bg-slate-50/40 transition">
                  <td className="p-3 font-mono font-bold text-slate-600">{acc.code}</td>
                  <td className="p-3 text-slate-700 font-semibold">{acc.name}</td>
                  <td className="p-3">
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={balances[acc.code]?.dr || ''} 
                      onChange={e => handleInputChange(acc.code, 'dr', e.target.value)} 
                      className="w-full p-2 bg-slate-50/80 border rounded-lg font-mono text-right font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition" 
                    />
                  </td>
                  <td className="p-3">
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={balances[acc.code]?.cr || ''} 
                      onChange={e => handleInputChange(acc.code, 'cr', e.target.value)} 
                      className="w-full p-2 bg-slate-50/80 border rounded-lg font-mono text-right font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}