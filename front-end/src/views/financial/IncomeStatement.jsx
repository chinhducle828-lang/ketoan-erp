/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { TrendingUp, TrendingDown, FileText, Layers, RefreshCw } from 'lucide-react';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';

export default function IncomeStatement() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({});
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());
  const [prevYearRevenue, setPrevYearRevenue] = useState(0);
  const [activeTab, setActiveTab] = useState('income-statement');
  const [cycleData, setCycleData] = useState(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  
  // Thuế suất lũy tiến theo doanh thu (đồng bộ với backend calculateProgressiveTax)
  const getProgressiveTaxRate = (revenue) => {
    if (revenue <= 3000000000) return 0.15;
    if (revenue <= 50000000000) return 0.17;
    return 0.20;
  };
  
  const getTaxModeLabel = (revenue) => {
    if (revenue <= 3000000000) return '15% (≤ 3 tỷ)';
    if (revenue <= 50000000000) return '17% (3-50 tỷ)';
    return '20% (> 50 tỷ)';
  };

  useEffect(() => {
    if (activeCompany) {
      fetchVouchers();
    }
  }, [activeCompany, contextFiscalYear]);

  useEffect(() => {
    if (activeCompany && activeTab === 'cycles') {
      fetchCycleData();
    }
  }, [activeCompany, fiscalYear, activeTab]);

  const fetchCycleData = useCallback(async () => {
    if (!activeCompany) return;
    
    setCycleLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
      const response = await api.get(`/report/cycle-data?company_id=${companyId}&year=${fiscalYear}`);
      
      if (response.data?.success) {
        setCycleData(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi tải dữ liệu 9 chu trình:', error);
    } finally {
      setCycleLoading(false);
    }
  }, [activeCompany, fiscalYear]);

  const fetchVouchers = useCallback(async () => {
    if (!activeCompany) return;
    
    setLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
      // Sử dụng API báo cáo kết quả kinh doanh B02-DN
      const response = await api.get(`/report/b02?company_id=${companyId}&year=${fiscalYear}`);
      
      if (response.data?.success && response.data.data) {
        // Backend trả về dữ liệu income statement dạng { revenue, cogs, ... }
        // Chuyển đổi thành ledger format để tương thích với code hiện tại
        const data = response.data.data;
        const ledgerData = {};
        
        // Map các giá trị từ API response vào ledger format
        if (data.revenue !== undefined) {
          ledgerData['511'] = { patsinhDr: 0, patsinhCr: data.revenue, closingDr: 0, closingCr: data.revenue };
        }
        if (data.cogs !== undefined) {
          ledgerData['632'] = { patsinhDr: data.cogs, patsinhCr: 0, closingDr: data.cogs, closingCr: 0 };
        }
        if (data.financialRevenue !== undefined) {
          ledgerData['515'] = { patsinhDr: 0, patsinhCr: data.financialRevenue, closingDr: 0, closingCr: data.financialRevenue };
        }
        if (data.operatingExpenses) {
          if (data.operatingExpenses['635']) {
            ledgerData['635'] = { patsinhDr: data.operatingExpenses['635'], patsinhCr: 0, closingDr: data.operatingExpenses['635'], closingCr: 0 };
          }
          if (data.operatingExpenses['641']) {
            ledgerData['641'] = { patsinhDr: data.operatingExpenses['641'], patsinhCr: 0, closingDr: data.operatingExpenses['641'], closingCr: 0 };
          }
          if (data.operatingExpenses['642']) {
            ledgerData['642'] = { patsinhDr: data.operatingExpenses['642'], patsinhCr: 0, closingDr: data.operatingExpenses['642'], closingCr: 0 };
          }
        }
        if (data.otherIncome !== undefined) {
          ledgerData['711'] = { patsinhDr: 0, patsinhCr: data.otherIncome, closingDr: 0, closingCr: data.otherIncome };
        }
        if (data.otherExpenses !== undefined) {
          ledgerData['811'] = { patsinhDr: data.otherExpenses, patsinhCr: 0, closingDr: data.otherExpenses, closingCr: 0 };
        }
        if (data.taxExpense !== undefined) {
          ledgerData['821'] = { patsinhDr: data.taxExpense, patsinhCr: 0, closingDr: data.taxExpense, closingCr: 0 };
        }
        
        setLedger(ledgerData);
      }
    } catch (error) {
      console.error('Lỗi tải số liệu:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, fiscalYear]);

  const refreshCyclesIfOpened = useCallback(() => {
    if (activeTab === 'cycles') {
      return fetchCycleData();
    }
    return Promise.resolve();
  }, [activeTab, fetchCycleData]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    {
      reports: fetchVouchers,
      cycles: refreshCyclesIfOpened
    },
    {
      eventMap: {
        'voucher:created': ['reports', 'cycles'],
        'voucher:updated': ['reports', 'cycles'],
        'voucher:deleted': ['reports', 'cycles'],
        voucherCreated: ['reports', 'cycles'],
        voucherUpdated: ['reports', 'cycles'],
        voucherDeleted: ['reports', 'cycles'],
        'closing:completed': ['reports', 'cycles'],
        closingCompleted: ['reports', 'cycles']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(activeCompany) });

  const getLedgerValue = (accountCode, entryType) => {
    const key = accountCode;
    if (!ledger[key]) return 0;
    return entryType === 'credit' ? (ledger[key].patsinhCr || 0) : (ledger[key].patsinhDr || 0);
  };

  const calculateMetrics = () => {
    const revenue = getLedgerValue('511', 'credit');
    const cogs = getLedgerValue('632', 'debit');
    const grossProfit = revenue - cogs;
    const financialRevenue = getLedgerValue('515', 'credit');
    
    const operatingExpenses = {
      '635': getLedgerValue('635', 'debit'),
      '641': getLedgerValue('641', 'debit'),
      '642': getLedgerValue('642', 'debit'),
    };

    const totalOperatingExpenses = Object.values(operatingExpenses).reduce((sum, val) => sum + val, 0);
    const operatingProfit = grossProfit + financialRevenue - totalOperatingExpenses;
    const totalOtherIncome = getLedgerValue('711', 'credit');
    const totalOtherExpenses = getLedgerValue('811', 'debit');
    const profitBeforeTax = operatingProfit + (totalOtherIncome - totalOtherExpenses);
    // Tính thuế lũy tiến dựa trên doanh thu (giống backend calculateProgressiveTax)
    const progressiveRate = getProgressiveTaxRate(revenue);
    const calculatedTax = profitBeforeTax > 0 ? profitBeforeTax * progressiveRate : 0;
    const incomeTaxExpense = getLedgerValue('821', 'debit') || calculatedTax;
    const netProfit = profitBeforeTax - incomeTaxExpense;

    return {
      revenue, cogs, grossProfit, financialRevenue,
      operatingExpenses, totalOperatingExpenses, operatingProfit,
      totalOtherIncome, totalOtherExpenses, profitBeforeTax,
      incomeTaxExpense, netProfit,
      progressiveRate: getProgressiveTaxRate(revenue),
      taxModeLabel: getTaxModeLabel(revenue)
    };
  };

  const metrics = calculateMetrics();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: getDefaultCurrency(),
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

  const renderCycleTable = () => {
    if (cycleLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-3" size={32} />
            <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu 9 chu trình nghiệp vụ...</p>
          </div>
        </div>
      );
    }

    if (!cycleData) {
      return (
        <div className="text-center py-12 text-slate-400">
          <p className="text-xs">Chưa có dữ liệu cho 9 chu trình nghiệp vụ</p>
        </div>
      );
    }

    const cycleLabels = {
      cycle1: { accounts: 'TK 411, 121, 128, 221, 515' },
      cycle2: { accounts: 'TK 152, 156, 1331, 331' },
      cycle3: { accounts: 'TK 632, 156, 131, 511, 3331' },
      cycle4: { accounts: 'TK 622, 641, 642, 334, 338' },
      cycle5: { accounts: 'TK 211, 214, 1332, 331' },
      cycle6: { accounts: 'TK 154, 621, 622, 627' },
      cycle7: { accounts: 'TK 341, 635, 335' },
      cycle8: { accounts: 'TK 3331, 133' },
      cycle9: { accounts: 'TK 911, 4212' }
    };

    return (
      <div className="space-y-4">
        {Object.entries(cycleData).map(([cycleKey, cycle]) => (
          <div key={cycleKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs">
                  {cycleKey.replace('cycle', 'Chu trình ')}
                </span>
                {cycle.name}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">{cycleLabels[cycleKey]?.accounts}</p>
            </div>
            <div className="p-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 font-bold text-slate-500">
                    <th className="pb-2 text-slate-600">Hạng mục</th>
                    <th className="pb-2 text-right font-mono">Số liệu thực tế (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(cycle.data).map(([key, value]) => (
                    <tr key={key} className="hover:bg-slate-50/30 transition">
                      <td className="py-2 text-slate-600 capitalize">{key.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(value)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/50 font-bold">
                    <td className="py-2 text-slate-800">Tổng cộng</td>
                    <td className="py-2 text-right font-mono font-black text-indigo-700">
                      {formatCurrency(cycle.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('income-statement')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'income-statement'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Báo cáo KQKD
        </button>
        <button
          onClick={() => setActiveTab('cycles')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'cycles'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers size={14} />
          9 Chu trình nghiệp vụ
        </button>
      </div>

      {/* Year Selector & Previous Year Revenue - Only show for income statement tab */}
      {activeTab === 'income-statement' && (
        <div className="flex flex-col md:flex-row gap-4 items-start">
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
          
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-600">Doanh thu năm {fiscalYear - 1}:</span>
            <input
              type="number"
              value={prevYearRevenue}
              onChange={(e) => setPrevYearRevenue(Number(e.target.value))}
              placeholder="Nhập doanh thu năm trước..."
              className="w-40 bg-transparent border border-slate-200 rounded px-2 py-1 text-right font-mono text-xs focus:outline-none focus:border-emerald-400"
            />
            <span className="text-slate-400">VNĐ</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span>Thuế suất TNDN áp dụng: {Math.round(metrics.progressiveRate * 100)}%</span>
            <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">{metrics.taxModeLabel}</span>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'cycles' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="text-indigo-600" size={20} />
              9 Chu trình nghiệp vụ
            </h2>
            {renderCycleTable()}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px]">I</span>
                DOANH THU THUẦN VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
              </h3>
              {renderRow('Doanh thu bán hàng và cung cấp dịch vụ (511)', metrics.revenue, false, false, false)}
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">II</span>
                GIÁ VỐN HÀNG BÁN
              </h3>
              {renderRow('Giá vốn hàng bán (632)', metrics.cogs, false, false, true)}
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
              <h3 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">III</span>
                LỢI NHUẬN GỘP VỀ BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ
              </h3>
              {renderRow('Lợi nhuận gộp (III = I - II)', metrics.grossProfit, true, false)}
            </div>

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

            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100">
              <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">V</span>
                LỢI NHUẬN THUẦN TỪ HOẠT ĐỘNG KINH DOANH
              </h3>
              {renderRow('Lợi nhuận thuần từ HĐKD', metrics.operatingProfit, true, false)}
            </div>

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

            <div>
              {renderRow('Tổng lợi nhuận kế toán trước thuế', metrics.profitBeforeTax, false, false)}
              {renderRow('Chi phí thuế TNDN hiện hành (821)', metrics.incomeTaxExpense, false, false, true)}
            </div>

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
      )}
    </div>
  );
}