/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';

export default function CashFlowDashboard() {
  const { vouchers, fetchCashFlow } = useVouchers();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;

  const [cashFlow, setCashFlow] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadCashFlow = useCallback(() => {
    if (!companyId) return Promise.resolve();
    setLoading(true);

    return fetchCashFlow(companyId, new Date().getFullYear(), 'indirect')
      .then((data) => {
        setCashFlow(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companyId, fetchCashFlow]);

  // Lấy báo cáo dòng tiền chuẩn B03-DN từ backend (tính từ voucher thực tế)
  useEffect(() => {
    loadCashFlow();
  }, [loadCashFlow]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { cashflow: loadCashFlow },
    {
      eventMap: {
        'voucher:created': ['cashflow'],
        'voucher:updated': ['cashflow'],
        'voucher:deleted': ['cashflow'],
        voucherCreated: ['cashflow'],
        voucherUpdated: ['cashflow'],
        voucherDeleted: ['cashflow'],
        'closing:completed': ['cashflow'],
        closingCompleted: ['cashflow']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(companyId) });

  // Lịch sử thu/chi: mọi voucher có dòng tiền qua tài khoản tiền (111, 112)
  const { inFlow, outFlow, cashVouchers } = useMemo(() => {
    let thu = 0, chi = 0;
    const history = [];

    vouchers.forEach((v) => {
      let amount = 0;
      let hasCashLine = false;
      if (v.details && Array.isArray(v.details)) {
        v.details.forEach((dt) => {
          if (dt.accountCode?.startsWith('111') || dt.accountCode?.startsWith('112')) {
            hasCashLine = true;
            if (dt.entryType === 'DR') {
              thu += parseFloat(dt.amount || 0);
              amount = parseFloat(dt.amount || 0);
            } else if (dt.entryType === 'CR') {
              chi += parseFloat(dt.amount || 0);
              amount = parseFloat(dt.amount || 0);
            }
          }
        });
      }
      // Hiển thị TẤT CẢ voucher có dòng tiền (NK thanh tiền, XK thu tiền, PT, PC, PKT...)
      if (hasCashLine) {
        history.push({ ...v, calculatedAmount: amount });
      }
    });

    return { inFlow: thu, outFlow: chi, cashVouchers: history };
  }, [vouchers]);

  // Nếu backend trả về dữ liệu B03, ưu tiên dùng để hiển thị tổng quan
  const summaryInFlow = cashFlow?.operatingActivities?.cashReceivedFromCustomers
    ?? cashFlow?.financingActivities?.cashReceivedFromLoans
    ?? inFlow;
  const summaryOutFlow = cashFlow?.operatingActivities?.cashPaidToSuppliers
    ?? cashFlow?.operatingActivities?.cashPaidToEmployees
    ?? outFlow;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
        <DollarSign className="text-emerald-500" /> TỔNG QUAN DÒNG TIỀN QUỸ
      </h1>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={16} className="animate-spin" /> Đang tải báo cáo dòng tiền từ hệ thống...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={32} /></div>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Tổng Dòng Tiền Vào (Inflow)</p>
            <h2 className="text-3xl font-black text-emerald-800 mt-1">{Number(summaryInFlow || 0).toLocaleString('vi-VN')} đ</h2>
          </div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-center gap-4">
          <div className="p-4 bg-rose-100 text-rose-600 rounded-full"><TrendingDown size={32} /></div>
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Tổng Dòng Tiền Ra (Outflow)</p>
            <h2 className="text-3xl font-black text-rose-800 mt-1">{Number(summaryOutFlow || 0).toLocaleString('vi-VN')} đ</h2>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b font-bold text-slate-600 text-xs uppercase tracking-wider">
          Lịch sử thu chi gần đây (từ chứng từ kế toán)
        </div>
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {cashVouchers.slice(0, 10).map((v, idx) => (
              <tr key={v.id || idx} className="hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-500">{v.voucherDate?.split('T')[0]}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${v.type === 'PT' ? 'bg-emerald-100 text-emerald-700' : v.type === 'PC' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{v.type}</span>
                </td>
                <td className="p-3">{v.description}</td>
                <td className="p-3 text-right font-bold">{Number(v.calculatedAmount || 0).toLocaleString('vi-VN')} đ</td>
              </tr>
            ))}
            {cashVouchers.length === 0 && (
              <tr><td colSpan="4" className="p-6 text-center text-slate-400">Chưa có phát sinh quỹ.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}