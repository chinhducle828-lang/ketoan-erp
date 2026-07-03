import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Calculator, Loader2 } from 'lucide-react';
import api from '../../utils/api.js';

export default function InventoryCosting() {
  const { activeCompany } = useAuth();
  
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleRunCosting = async () => {
    if (!activeCompany) return alert('Hệ thống yêu cầu chọn doanh nghiệp trước khi chạy tính giá vốn!');
    
    if (!window.confirm(`Xác nhận thực thi tính giá xuất kho Bình quân gia quyền cho Tháng ${month}/${year}? Toàn bộ đơn giá xuất cũ trong tháng này sẽ được ghi đè tự động.`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const companyId = activeCompany?.id || activeCompany;
      const res = await api.post('/inventory/costing', {
        company_id: companyId,
        month: parseInt(month, 10),
        year: parseInt(year, 10)
      });
      
      setResult({ type: 'success', message: res.data?.message || 'Tính giá xuất kho thành công!' });
    } catch (err) {
      setResult({ type: 'error', message: err.response?.data?.error || 'Gặp lỗi trong quá trình dồn tích tính toán dữ liệu kho!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div>
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2"><Calculator size={18} className="text-sky-500" /> Xử Lý Cuối Kỳ: Tính Giá Xuất Kho</h2>
        <p className="text-slate-400 text-xs">Áp dụng thuật toán Bình quân gia quyền cuối kỳ chuẩn Thông tư 99</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Tháng tính toán</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Năm tài chính</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none text-center" />
        </div>
      </div>

      <button onClick={handleRunCosting} disabled={loading} className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        {loading ? 'Hệ thống đang chạy thuật toán dồn tích kho...' : 'Thực thi áp đơn giá xuất kho cuối kỳ'}
      </button>

      {result && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${result.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}

//