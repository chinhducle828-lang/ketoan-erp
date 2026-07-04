import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculateBalances, getTotalDebit, getTotalCredit } from '../../utils/accountingEngine.js';
import { TrendingUp, TrendingDown, FileText, RefreshCw, Calendar } from 'lucide-react';

// Báo cáo kết quả kinh doanh mẫu B02-DN
const REVENUE_ACCOUNTS = [
  { code: '511', name: 'Doanh thu bán hàng hóa', type: 'credit' },
  { code: '512', name: 'Doanh thu bán các thành phẩm', type: 'credit' },
  { code: '513', name: 'Doanh thu cung cấp dịch vụ', type: 'credit' },
  { code: '515', name: 'Doanh thu hoạt động tài chính', type: 'credit' },
];

const COST_OF_GOODS_ACCOUNTS = [
  { code: '632', name: 'Giá vốn hàng bán', type: 'debit' },
];

const OPERATING_EXPENSES = [
  { code: '635', name: 'Chi phí tài chính', type: 'debit' },
  { code: '641', name: 'Chi phí bán hàng', type: 'debit' },
  { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: 'debit' },
];

const OTHER_INCOME_EXPENSES = [
  { code: '711', name: 'Thu nhập khác', type: 'credit' },
  { code: '811', name: 'Chi phí khác', type: 'debit' },
];

const TAX_ACCOUNTS = [
  { code: '821', name: 'Chi phí thuế TNDN', type: 'debit' },
];

export default function IncomeStatementB02() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({});
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());
  const [prevYearRevenue, setPrevYearRevenue] = useState(0);
  const [taxRate, setTaxRate] = useState(0.2);

  useEffect(() => {
    if (activeCompany) {
      fetchIncomeStatement();
    }
  }, [activeCompany, fiscalYear]);

  const fetchIncomeStatement = async () => {
    if (!activeCompany) return;
    
    setLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
const response = await api.get(`/api/report/b02?company_id=${companyId}&year=${fiscalYear}`);
      
      if (response.data?.success && response.data.data) {
        setLedger(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi tải báo cáo kết quả kinh doanh:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaxRateByRevenue = (revenue) => {
    if (revenue <= 3000000000) return 0.15;
    if (revenue <= 50000000000) return 0.17;
    return 0.20;
  };

  const calculateMetrics = () => {
    // Doanh thu
    let totalRevenue = 0;
    REVENUE_ACCOUNTS.forEach(acc => {
      totalRevenue += getTotalCredit(ledger, acc.code);
    });

    // Giá vốn hàng bán
    let totalCOGS = 0;
    COST_OF_GOODS_ACCOUNTS.forEach(acc => {
      totalCOGS += getTotalDebit(ledger, acc.code);
    });

    // Chi phí
    let totalOperatingExpenses = 0;
    OPERATING_EXPENSES.forEach(acc => {
      totalOperatingExpenses += getTotalDebit(ledger, acc.code);
    });

    // Thu nhập khác
    let totalOtherIncome = 0;
    OTHER_INCOME_EXPENSES.filter(acc => acc.type === 'credit').forEach(acc => {
      totalOtherIncome += getTotalCredit(ledger, acc.code);
    });

    // Chi phí khác
    let totalOtherExpenses = 0;
    OTHER_INCOME_EXPENSES.filter(acc => acc.type === 'debit').forEach(acc => {
      totalOtherExpenses += getTotalDebit(ledger, acc.code);
    });

    // Thuế TNDN
    let totalTaxExpense = 0;
    TAX_ACCOUNTS.forEach(acc => {
      totalTaxExpense += getTotalDebit(ledger, acc.code);
    });

    const grossProfit = totalRevenue - totalCOGS;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const profitBeforeTax = operatingProfit + (totalOtherIncome - totalOtherExpenses);
    const netProfit = profitBeforeTax - totalTaxExpense;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalOperatingExpenses,
      operatingProfit,
      totalOtherIncome,
      totalOtherExpenses,
      profitBeforeTax,
      totalTaxExpense,
      netProfit
    };
  };

  const metrics = calculateMetrics();
  const appliedTaxRate = getTaxRateByRevenue(prevYearRevenue);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const renderRow = (label, value, isBold = false, isNegative = false) => {
    const displayValue = isNegative ? -value : value;
    const valueClass = displayValue < 0 ? 'text-rose-600' : (isBold ? 'text-slate-900' : 'text-slate-700');
    
    return (
      <div className={`flex justify-between items-center py-2 ${isBold ? 'border-t border-slate-200 mt-2 pt-3' : ''} ${isBold ? 'font-bold' : 'font-medium'}`}>
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
          <p className="text-xs text-slate-500 font-medium">Đang tính toán báo cáo kết quả kinh doanh...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
            <TrendingUp className="text-emerald-600" size={24} />
            Báo Cáo Kết Quả Kinh Doanh Mẫu B02-DN
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Báo cáo tài chính theo Thông tư 99/2025/TT-BTC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Doanh thu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px]">I</span>
            DOANH THU THUẦN VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
          </h3>
          {REVENUE_ACCOUNTS.map(acc => {
            const value = acc.type === 'credit' ? getTotalCredit(ledger, acc.code) : getTotalDebit(ledger, acc.code);
            if (value === 0) return null;
            return renderRow(`${acc.code} ${acc.name}`, value, false, false);
          })}
          {renderRow('Tổng doanh thu', metrics.totalRevenue, true, false)}
        </div>
      </div>

      {/* Giá vốn */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">II</span>
            GIÁ VỐN HÀNG BÁN
          </h3>
          {COST_OF_GOODS_ACCOUNTS.map(acc => {
            const value = acc.type === 'credit' ? getTotalCredit(ledger, acc.code) : getTotalDebit(ledger, acc.code);
            if (value === 0) return null;
            return renderRow(`${acc.code} ${acc.name}`, value, false, true);
          })}
          {renderRow('Tổng giá vốn', metrics.totalCOGS, true, true)}
        </div>
      </div>

      {/* Lợi nhuận gộp */}
      <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
        <h3 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">III</span>
          LỢI NHUẬN GỘP VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
        </h3>
        {renderRow('Lợi nhuận gộp (III = I - II)', metrics.grossProfit, true, false)}
      </div>

      {/* Chi phí */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px]">IV</span>
            CHI PHÍ
          </h3>
          <div className="ml-4 space-y-1">
            {OPERATING_EXPENSES.map(acc => {
              const value = acc.type === 'credit' ? getTotalCredit(ledger, acc.code) : getTotalDebit(ledger, acc.code);
              if (value === 0) return null;
              return renderRow(`${acc.code} ${acc.name}`, value, false, true);
            })}
          </div>
          {renderRow('Tổng chi phí', metrics.totalOperatingExpenses, true, true)}
        </div>
      </div>

      {/* Lợi nhuận thuần */}
      <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100">
        <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">V</span>
          LỢI NHUẬN THUẦN TỪ HOẠT ĐỘNG KINH DOANH
        </h3>
        {renderRow('Lợi nhuận thuần (V = III - IV)', metrics.operatingProfit, true, false)}
      </div>

      {/* Thu nhập/chi phí khác */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px]">VI</span>
            THU NHẬP VÀ CHI PHÍ KHÁC
          </h3>
          <div className="ml-4 space-y-1">
            {OTHER_INCOME_EXPENSES.map(acc => {
              const value = acc.type === 'credit' ? getTotalCredit(ledger, acc.code) : getTotalDebit(ledger, acc.code);
              if (value === 0) return null;
              return renderRow(`${acc.code} ${acc.name}`, value, false, acc.type === 'debit');
            })}
          </div>
        </div>
      </div>

      {/* Lợi nhuận trước thuế */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-4">
          {renderRow('Tổng lợi nhuận kế toán trước thuế', metrics.profitBeforeTax, true, false)}
          {renderRow('Chi phí thuế TNDN (821)', metrics.totalTaxExpense, false, true)}
        </div>
      </div>

      {/* Lợi nhuận sau thuế */}
      <div className={`p-4 rounded-xl text-white shadow-md ${metrics.netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-600'}`}>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px]">VII</span>
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
  );
}