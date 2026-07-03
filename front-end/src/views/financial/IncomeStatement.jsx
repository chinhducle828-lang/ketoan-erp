// FILE_PATH: front-end/src/views/financial-statements/IncomeStatement.jsx
import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
// ĐÃ ĐỔI: Sử dụng getTotalDebit và getTotalCredit thay vì getClosingBalance cho TK doanh thu/chi phí
import { calculateBalances, getTotalDebit, getTotalCredit } from '../../utils/accountingEngine.js';
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
      // Gọi đúng API lấy danh sách chứng từ hạch toán của niên độ được chọn
      const response = await api.get(`/inventory/balances?company_id=${companyId}&year=${fiscalYear}`);
      
      if (response.data?.success && response.data.data?.accountLedger) {
        setLedger(response.data.data.accountLedger);
      }
    } catch (error) {
      console.error('Lỗi tải số liệu:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán các chỉ tiêu Báo cáo KQKD chuẩn theo nghiệp vụ kết chuyển
  const calculateMetrics = () => {
    // 1. Doanh thu bán hàng và cung cấp dịch vụ (Phát sinh CÓ TK 511)
    const revenue = getTotalCredit(ledger, '511');
    
    // 2. Giá vốn hàng bán (Phát sinh NỢ TK 632)
    const cogs = getTotalDebit(ledger, '632');
    
    // 3. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ
    const grossProfit = revenue - cogs;

    // 4. Doanh thu hoạt động tài chính (Phát sinh CÓ TK 515)
    const financialRevenue = getTotalCredit(ledger, '515');

    // 5. Chi phí hoạt động sản xuất kinh doanh trong kỳ
    const operatingExpenses = {
      '635': getTotalDebit(ledger, '635'), // Chi phí tài chính
      '641': getTotalDebit(ledger, '641'), // Chi phí bán hàng
      '642': getTotalDebit(ledger, '642'), // Chi phí quản lý doanh nghiệp
    };

    const totalOperatingExpenses = Object.values(operatingExpenses).reduce((sum, val) => sum + val, 0);

    // 6. Lợi nhuận thuần từ HĐKD (Doanh thu + Tài chính - Chi phí)
    const operatingProfit = grossProfit + financialRevenue - totalOperatingExpenses;

    // 7. Thu nhập khác (Phát sinh CÓ TK 711)
    const totalOtherIncome = getTotalCredit(ledger, '711');

    // 8. Chi phí khác (Phát sinh NỢ TK 811)
    const totalOtherExpenses = getTotalDebit(ledger, '811');

    // 9. Tổng lợi nhuận kế toán trước thuế
    const profitBeforeTax = operatingProfit + (totalOtherIncome - totalOtherExpenses);

    // 10. Chi phí thuế TNDN hiện hành (Phát sinh NỢ TK 821)
    const incomeTaxExpense = getTotalDebit(ledger, '821');

    // 11. Lợi nhuận sau thuế thu nhập doanh nghiệp (Chỉ tiêu thực tế của kỳ)
    const netProfit = profitBeforeTax - incomeTaxExpense;

    return {
      revenue,
      cogs,
      grossProfit,
      financialRevenue,
      operatingExpenses,
      totalOperatingExpenses,
      operatingProfit,
      totalOtherIncome,
      totalOtherExpenses,
      profitBeforeTax,
      incomeTaxExpense,
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
      <div className={`flex justify-between items-center py-2 ${isTotal ? 'border-t border-slate-200 mt-2 pt-3' : ''} ${isBold ? 'font-bold' : 'font-medium'}`}>
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
          {/* I. Doanh thu */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px]">I</span>
              DOANH THU THUẦN VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
            </h3>
            {renderRow('Doanh thu bán hàng và cung cấp dịch vụ (511)', metrics.revenue, false, false, false)}
          </div>

          {/* II. Giá vốn */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">II</span>
              GIÁ VỐN HÀNG BÁN
            </h3>
            {renderRow('Giá vốn hàng bán (632)', metrics.cogs, false, false, true)}
          </div>

          {/* III. Lợi nhuận gộp */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
            <h3 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">III</span>
              LỢI NHUẬN GỘP VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
            </h3>
            {renderRow('Lợi nhuận gộp (III = I - II)', metrics.grossProfit, true, false)}
          </div>

          {/* IV. Chi phí & Doanh thu tài chính */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px]">IV</span>
              HOẠT ĐỘNG KINH DOANH VÀ CHI PHÍ
            </h3>
            <div className="ml-4 space-y-1">
              {renderRow('Doanh thu hoạt động tài chính (515)', metrics.financialRevenue, false, false, false)}
              {renderRow('Chi phí tài chính (635)', metrics.operatingExpenses['635'], false, false, true)}
              {renderRow('Chi phí bán hàng (641)', metrics.operatingExpenses['641'], false, false, true)}
              {renderRow('Chi phí quản lý doanh nghiệp (642)', metrics.operatingExpenses['642'], false, false, true)}
            </div>
          </div>

          {/* V. Lợi nhuận thuần */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100">
            <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">V</span>
              LỢI NHUẬN THUẦN TỪ HOẠT ĐỘNG KINH DOANH
            </h3>
            {renderRow('Lợi nhuận thuần từ HĐKD', metrics.operatingProfit, true, false)}
          </div>

          {/* VI & VII. Khác */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px]">VI</span>
              THU NHẬP KHÁC VÀ CHI PHÍ KHÁC
            </h3>
            <div className="ml-4 space-y-1">
              {renderRow('Thu nhập khác (711)', metrics.totalOtherIncome, false, false, false)}
              {renderRow('Chi phí khác (811)', metrics.totalOtherExpenses, false, false, true)}
            </div>
          </div>

          {/* Thuế TNDN bổ sung */}
          <div>
            {renderRow('Tổng lợi nhuận kế toán trước thuế', metrics.profitBeforeTax, false, false)}
            {renderRow('Chi phí thuế TNDN hiện hành (821)', metrics.incomeTaxExpense, false, false, true)}
          </div>

          {/* VIII. Kết quả cuối cùng */}
          <div className={`p-4 rounded-xl text-white shadow-md ${metrics.netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-600'}`}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px]">VIII</span>
              LỢI NHUẬN SAU THUẾ THU NHẬP DOANH NGHIỆP
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white/90">LNST dòng của kỳ này:</span>
              <span className="text-lg font-black">{formatCurrency(metrics.netProfit)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-white/80 border-t border-white/10 pt-2">
              {metrics.netProfit >= 0 ? (
                <>
                  <TrendingUp size={14} />
                  <span>Doanh nghiệp hoạt động có lãi trong năm {fiscalYear}</span>
                </>
              ) : (
                <>
                  <TrendingDown size={14} />
                  <span>Doanh nghiệp lâm vào tình trạng lỗ ròng trong năm {fiscalYear}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}