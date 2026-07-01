import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Clock } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

const MONTHS = ['Thg 1','Thg 2','Thg 3','Thg 4','Thg 5','Thg 6','Thg 7','Thg 8','Thg 9','Thg 10','Thg 11','Thg 12'];

function CashFlowBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-bold text-slate-600 w-20 text-right">{Number(value || 0).toLocaleString()} đ</span>
    </div>
  );
}

export default function CashFlowDashboard() {
  const { activeCompany, fiscalYear } = useAuth();
  const [data, setData] = useState({ monthly: [], summary: { tong_thu_tien: 0, tong_chi_tien: 0 }, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!activeCompany?.id) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/api/dashboard/cashflow?company_id=${activeCompany.id}&year=${fiscalYear}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Không thể tải dữ liệu dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeCompany?.id, fiscalYear]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-xs text-slate-500">
      <BarChart3 className="animate-pulse mr-2 text-emerald-600" size={20} />
      Đang tải dữ liệu dòng tiền...
    </div>
  );

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-600 font-bold">{error}</div>
  );

  const { monthly, summary, recent } = data;
  const thu = Number(summary?.tong_thu_tien || 0);
  const chi = Number(summary?.tong_chi_tien || 0);
  const balance = thu - chi;
  const maxVal = Math.max(...monthly.map(m => Math.max(Number(m.thu) || 0, Number(m.chi) || 0)), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-emerald-600" size={24} /> DASHBOARD DÒNG TIỀN
          <span className="text-xs font-normal text-slate-400 ml-2">{activeCompany?.name} - Niên độ {fiscalYear}</span>
        </h1>
        <ExportExcelButton endpoint="dashboard" filename="Dashboard_Duong_Tien" label="Xuất Excel" />
      </div>

      {/* THẺ TỔNG QUAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp className="text-emerald-600" size={22} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tổng thu</p>
              <p className="text-lg font-black text-emerald-700">{thu.toLocaleString()} đ</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl"><TrendingDown className="text-rose-600" size={22} /></div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tổng chi</p>
              <p className="text-lg font-black text-rose-700">{chi.toLocaleString()} đ</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${balance >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <DollarSign className={balance >= 0 ? 'text-blue-600' : 'text-amber-600'} size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Số dư ròng</p>
              <p className={`text-lg font-black ${balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                {balance >= 0 ? '+' : ''}{balance.toLocaleString()} đ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ THU/CHI THEO THÁNG */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-emerald-600" /> Biểu đồ thu chi theo tháng
        </h3>
        {monthly.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">Chưa có dữ liệu giao dịch trong năm nay.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-[10px] font-bold mb-2">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Thu</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-400 inline-block" /> Chi</span>
            </div>
            {monthly.map(m => (
              <div key={m.month} className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500">{MONTHS[m.month - 1]}</div>
                <div className="pl-2 space-y-1">
                  <CashFlowBar value={m.thu} max={maxVal} color="bg-emerald-500" />
                  <CashFlowBar value={m.chi} max={maxVal} color="bg-rose-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GIAO DỊCH GẦN ĐÂY MASTER-DETAIL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" /> Giao dịch gần đây
        </h3>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">Chưa có giao dịch nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <th className="p-2.5">Ngày</th>
                  <th className="p-2.5">Loại</th>
                  <th className="p-2.5">Chi tiết hạch toán (TK)</th>
                  <th className="p-2.5">Diễn giải</th>
                  <th className="p-2.5 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map(v => {
                  // Tính toán tổng tiền thực tế của voucher từ danh sách details con
                  const voucherTotal = v.details?.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) || parseFloat(v.amount || 0);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition align-top">
                      <td className="p-2.5 font-mono">{v.voucher_date?.slice(0, 10)}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.voucher_type === 'Thu' || v.voucher_type === 'Nhap'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {v.voucher_type}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] space-y-0.5">
                        {v.details && v.details.length > 0 ? (
                          v.details.map((dt, idx) => (
                            <div key={idx}>
                              <span className={dt.entryType === 'DR' ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold pl-2'}>
                                {dt.entryType} {dt.accountCode}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400">Không có định khoản</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-[200px] truncate">{v.description}</td>
                      <td className="p-2.5 text-right font-bold text-slate-800">{voucherTotal.toLocaleString()} đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}