import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculateBalances, getClosingBalance } from '../../utils/accountingEngine.js';
import { TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';

export default function IncomeStatement() {
  const { activeCompany } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({});
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (activeCompany) {
      fetchVouchers();
    }
  }, [activeCompany, fiscalYear]);

  const fetchVouchers = async () => {
    if (!activeCompany) return;
    
    setLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
      const response = await api.get(`/inventory/balances?company_id=${companyId}`);
      
      if (response.data?.success && response.data.data?.accountLedger) {
        setLedger(response.data.data.accountLedger);
      }
    } catch (error) {
      console.error('Lỗi tải số liệu:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán các chỉ tiêu Báo cáo KQKD
  const calculateMetrics = () => {
    // Doanh thu bán hàng (511)
    const revenue = getClosingBalance(ledger, '511', 'revenue');
    
    // Giá vốn hàng bán (632)
    const cogs = getClosingBalance(ledger, '632', 'expense');
    
    // Lợi nhuận gộp
    const grossProfit = revenue - cogs;

    // Chi phí hoạt động (các tài khoản 6xx)
    const operatingExpenses = {
      '641': getClosingBalance(ledger, '641', 'expense'), // Chi phí bán hàng
      '642': getClosingBalance(ledger, '642', 'expense'), // Chi phí quản lý doanh nghiệp
      '643': getClosingBalance(ledger, '643', 'expense'), // Chi phí tài chính
      '644': getClosingBalance(ledger, '644', 'expense'), // Chi phí bán hàng (chi tiết)
      '650': getClosingBalance(ledger, '650', 'expense'), // Chi phí quản lý (chi tiết)
      '651': getClosingBalance(ledger, '651', 'expense'), // Chi phí bán hàng (chi tiết)
      '652': getClosingBalance(ledger, '652', 'expense'), // Chi phí nghiên cứu
      '653': getClosingBalance(ledger, '653', 'expense'), // Chi phí thuế
      '654': getClosingBalance(ledger, '654', 'expense'), // Chi phí khác
      '655': getClosingBalance(ledger, '655', 'expense'), // Chi phí tài chính (chi tiết)
      '656': getClosingBalance(ledger, '656', 'expense'), // Chi phí bán hàng (chi tiết)
      '657': getClosingBalance(ledger, '657', 'expense'), // Chi phí quản lý (chi tiết)
      '658': getClosingBalance(ledger, '658', 'expense'), // Chi phí khác (chi tiết)
    };

    const totalOperatingExpenses = Object.values(operatingExpenses).reduce((sum, val) => sum + Math.abs(val), 0);

    // Lợi nhuận thuần từ HĐKD
    const operatingProfit = grossProfit - totalOperatingExpenses;

    // Thu nhập khác (711, 712, 713, 714, 715, 716, 717, 718, 719)
    const otherIncome = {
      '711': getClosingBalance(ledger, '711', 'revenue'),
      '712': getClosingBalance(ledger, '712', 'revenue'),
      '713': getClosingBalance(ledger, '713', 'revenue'),
      '714': getClosingBalance(ledger, '714', 'revenue'),
      '715': getClosingBalance(ledger, '715', 'revenue'),
      '716': getClosingBalance(ledger, '716', 'revenue'),
      '717': getClosingBalance(ledger, '717', 'revenue'),
      '718': getClosingBalance(ledger, '718', 'revenue'),
      '719': getClosingBalance(ledger, '719', 'revenue'),
    };
    const totalOtherIncome = Object.values(otherIncome).reduce((sum, val) => sum + val, 0);

    // Chi phí khác (635, 641, 642, 643, 644, 650, 651, 652, 653, 654, 655, 656, 657, 658, 659)
    const otherExpenses = {
      '635': getClosingBalance(ledger, '635', 'expense'),
      '641': getClosingBalance(ledger, '641', 'expense'),
      '642': getClosingBalance(ledger, '642', 'expense'),
      '643': getClosingBalance(ledger, '643', 'expense'),
      '644': getClosingBalance(ledger, '644', 'expense'),
      '650': getClosingBalance(ledger, '650', 'expense'),
      '651': getClosingBalance(ledger, '651', 'expense'),
      '652': getClosingBalance(ledger, '652', 'expense'),
      '653': getClosingBalance(ledger, '653', 'expense'),
      '654': getClosingBalance(ledger, '654', 'expense'),
      '655': getClosingBalance(ledger, '655', 'expense'),
      '656': getClosingBalance(ledger, '656', 'expense'),
      '657': getClosingBalance(ledger, '657', 'expense'),
      '658': getClosingBalance(ledger, '658', 'expense'),
      '659': getClosingBalance(ledger, '659', 'expense'),
    };
    const totalOtherExpenses = Object.values(otherExpenses).reduce((sum, val) => sum + Math.abs(val), 0);

    // LNSTCPP (421)
    const netProfit = getClosingBalance(ledger, '421', 'expense');

    return {
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses,
      operatingProfit,
      otherIncome,
      totalOtherIncome,
      otherExpenses,
      totalOtherExpenses,
      netProfit
    };
  };

  const metrics = calculateMetrics();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const renderRow = (label, value, isBold = false, isTotal = false, isNegative = false) => {
    const displayValue = isNegative ? -value : value;
    const valueClass = displayValue < 0 ? 'text-rose-600' : (isTotal ? 'text-slate-900' : 'text-slate-700');
    
    return (
      <div className={`flex justify-between items-center py-2 ${isTotal ? 'border-t-2 border-slate-300 mt-2 pt-3' : ''} ${isBold ? 'font-bold' : 'font-medium'}`}>
        <span className={`text-xs ${isBold ? 'text-slate-900' : 'text-slate-600'}`}>
          {label}
        </span>
        <span className={`text-xs ${valueClass} ${isBold ? 'text-sm' : ''}`}>
          {formatCurrency(displayValue)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Đang tính toán báo cáo lãi lỗ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
          <TrendingUp className="text-emerald-600" size={24} />
          Báo Cáo Kết Quả Hoạt Động Kinh Doanh
        </h1>
        <p className="text-xs text-slate-400 mt-1 italic">
          Báo cáo tài chính theo Thông tư 99/2025/TT-BTC
        </p>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm w-fit">
        <FileText size={14} className="text-blue-500" />
        <span className="text-slate-600">Niên độ kế toán:</span>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(Number(e.target.value))}
          className="bg-transparent border-none focus:outline-none font-bold text-slate-800 cursor-pointer pl-1"
        >
          {[2024, 2025, 2026, 2027, 2028].map(y => (
            <option key={y} value={y}>Năm {y}</option>
          ))}
        </select>
      </div>

      {/* Income Statement */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {/* I. Doanh thu thuần về bán hàng và cung cấp dịch vụ */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px]">I</span>
              DOANH THU THUẦN VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
            </h3>
            {renderRow('Doanh thu bán hàng (511)', metrics.revenue, false, false, false)}
          </div>

          {/* II. Giá vốn hàng bán */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">II</span>
              GIÁ VỐN HÀNG BÁN
            </h3>
            {renderRow('Giá vốn hàng bán (632)', metrics.cogs, false, false, true)}
          </div>

          {/* III. Lợi nhuận gộp */}
          <div className="bg-emerald-50 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">III</span>
              LỢI NHUẬN GỘP VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
            </h3>
            {renderRow('Lợi nhuận gộp (III = I - II)', metrics.grossProfit, true, true)}
          </div>

          {/* IV. Chi phí hoạt động */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px]">IV</span>
              CHI PHÍ HOẠT ĐỘNG
            </h3>
            <div className="ml-4 space-y-1">
              {Object.entries(metrics.operatingExpenses).map(([code, value]) => {
                if (value !== 0) {
                  return renderRow(`Chi phí (${code})`, value, false, false, true);
                }
                return null;
              })}
            </div>
            {renderRow('Tổng chi phí hoạt động', metrics.totalOperatingExpenses, false, false, true)}
          </div>

          {/* V. Lợi nhuận thuần từ HĐKD */}
          <div className="bg-blue-50 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">V</span>
              LỢI NHUẬN THUẦN TỪ HOẠT ĐỘNG KINH DOANH
            </h3>
            {renderRow('Lợi nhuận thuần từ HĐKD (V = III - IV)', metrics.operatingProfit, true, true)}
          </div>

          {/* VI. Thu nhập khác */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px]">VI</span>
              THU NHẬP KHÁC
            </h3>
            <div className="ml-4 space-y-1">
              {Object.entries(metrics.otherIncome).map(([code, value]) => {
                if (value !== 0) {
                  return renderRow(`Thu nhập (${code})`, value, false, false, false);
                }
                return null;
              })}
            </div>
            {renderRow('Tổng thu nhập khác', metrics.totalOtherIncome, false, false, false)}
          </div>

          {/* VII. Chi phí khác */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px]">VII</span>
              CHI PHÍ KHÁC
            </h3>
            <div className="ml-4 space-y-1">
              {Object.entries(metrics.otherExpenses).map(([code, value]) => {
                if (value !== 0) {
                  return renderRow(`Chi phí (${code})`, value, false, false, true);
                }
                return null;
              })}
            </div>
            {renderRow('Tổng chi phí khác', metrics.totalOtherExpenses, false, false, true)}
          </div>

          {/* VIII. LNSTCPP */}
          <div className={`p-4 rounded-xl ${metrics.netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px]">VIII</span>
              LỢI NHUẬN SAU THUẾ THU NHẬP DOANH NGHIỆP
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/90">
                LNSTCPP (421)
              </span>
              <span className="text-lg font-black text-white">
                {formatCurrency(metrics.netProfit)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
              {metrics.netProfit >= 0 ? (
                <>
                  <TrendingUp size={14} />
                  <span>Công ty có lãi</span>
                </>
              ) : (
                <>
                  <TrendingDown size={14} />
                  <span>Công ty lỗ</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Doanh thu</div>
          <div className="text-lg font-black text-slate-800">{formatCurrency(metrics.revenue)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lợi nhuận gộp</div>
          <div className="text-lg font-black text-emerald-600">{formatCurrency(metrics.grossProfit)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lợi nhuận HĐKD</div>
          <div className="text-lg font-black text-blue-600">{formatCurrency(metrics.operatingProfit)}</div>
        </div>
        <div className={`p-4 rounded-xl border shadow-sm ${metrics.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">LNSTCPP</div>
          <div className={`text-lg font-black ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(metrics.netProfit)}
          </div>
        </div>
      </div>
    </div>
  );
}