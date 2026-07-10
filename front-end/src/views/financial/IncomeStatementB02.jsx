/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { useAuth } from '../../context/AuthContext.jsx';
// Accounting functions removed - now using API
import { TrendingUp, TrendingDown, FileText, Download, RefreshCw } from 'lucide-react';

// Mẫu B02-DN theo Thông tư 99/2025/TT-BTC
const REPORT_ITEMS = [
  { code: '01', name: 'Doanh thu bán hàng và cung cấp dịch vụ', accounts: ['511', '512', '513'] },
  { code: '02', name: 'Các khoản giảm trừ doanh thu', accounts: ['5211', '5212', '5213'] },
  { code: '10', name: 'Doanh thu thuần về bán hàng và cung cấp dịch vụ (10=01-02)', isFormula: true },
  { code: '11', name: 'Giá vốn hàng bán', accounts: ['632'] },
  { code: '20', name: 'Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20=10-11)', isFormula: true },
  { code: '21', name: 'Doanh thu hoạt động tài chính', accounts: ['515'] },
  { code: '22', name: 'Chi phí tài chính', accounts: ['635'] },
  { code: '23', name: 'Trong đó: Chi phí lãi vay', accounts: ['6351'] },
  { code: '24', name: 'Chi phí bán hàng', accounts: ['641'] },
  { code: '25', name: 'Chi phí quản lý doanh nghiệp', accounts: ['642'] },
  { code: '30', name: 'Lợi nhuận thuần từ hoạt động kinh doanh (30=20+21-22-24-25)', isFormula: true },
  { code: '31', name: 'Thu nhập khác', accounts: ['711'] },
  { code: '32', name: 'Chi phí khác', accounts: ['811'] },
  { code: '40', name: 'Lợi nhuận khác (40=31-32)', isFormula: true },
  { code: '50', name: 'Tổng lợi nhuận kế toán trước thuế (50=30+40)', isFormula: true },
  { code: '51', name: 'Chi phí thuế TNDN hiện hành', accounts: ['821'] },
  { code: '52', name: 'Chi phí thuế TNDN hoãn lại', accounts: ['822'] },
  { code: '60', name: 'Lợi nhuận sau thuế TNDN (60=50-51-52)', isFormula: true },
];

export default function IncomeStatementB02() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({});
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());

  useEffect(() => {
    if (activeCompany) {
      fetchData();
    }
  }, [activeCompany, fiscalYear]);

  const fetchData = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
      const response = await api.get(`/api/report/b02?company_id=${companyId}&year=${fiscalYear}`);
      if (response.data?.success && response.data.data) {
        setLedger(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi tải báo cáo KQKD:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemValue = (item) => {
    if (item.accounts) {
      let total = 0;
      item.accounts.forEach(accCode => {
        // Doanh thu = Tổng Có, Chi phí = Tổng Nợ
        const accountData = ledger[accCode];
        const debit = accountData?.patsinhDr || 0;
        const credit = accountData?.patsinhCr || 0;
        // Với TK doanh thu (5, 7), lấy credit. Với TK chi phí (6, 8), lấy debit
        if (accCode.startsWith('5') || accCode.startsWith('7')) {
          total += credit;
        } else if (accCode.startsWith('6') || accCode.startsWith('8')) {
          total += debit;
        } else {
          total += Math.abs(debit - credit);
        }
      });
      return total;
    }
    return 0;
  };

  const calculateItems = () => {
    const values = {};
    REPORT_ITEMS.forEach(item => {
      if (item.isFormula) {
        values[item.code] = evaluateFormula(item, values);
      } else {
        values[item.code] = getItemValue(item);
      }
    });
    return values;
  };

  const evaluateFormula = (item, values) => {
    // Parse formula like "20=10-11"
    const formula = item.name.split('(')[1]?.replace(')', '') || '';
    if (formula.includes('=')) {
      const expr = formula.split('=')[1];
      try {
        const evaluated = evalExpression(expr, values);
        return evaluated;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const evalExpression = (expr, values) => {
    const tokens = expr.split(/([+\-*/])/);
    let result = 0;
    let operator = '+';
    tokens.forEach(token => {
      token = token.trim();
      if (token === '+' || token === '-' || token === '*' || token === '/') {
        operator = token;
      } else if (token) {
        const num = parseFloat(values[token]) || 0;
        switch (operator) {
          case '+': result += num; break;
          case '-': result -= num; break;
          case '*': result *= num; break;
          case '/': result = num !== 0 ? result / num : 0; break;
        }
      }
    });
    return result;
  };

  const values = calculateItems();
  const netProfit = values['60'] || 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: getDefaultCurrency(),
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const handleExportExcel = () => {
    let csv = '\uFEFF';
    csv += 'BÁO CÁO KẾT QUẢ KINH DOANH B02-DN\n';
    csv += `Năm tài chính: ${fiscalYear}\n\n`;
    csv += 'Mã chỉ tiêu,Tên chỉ tiêu,Kỳ này,Lũy kế từ đầu năm\n';

    REPORT_ITEMS.forEach(item => {
      const value = values[item.code] || 0;
      csv += `${item.code},"${item.name.split('(')[0].trim()}",${value},${value}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `B02-DN_${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Đang tính toán báo cáo KQKD B02-DN...</p>
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
            Báo Cáo Kết Quả Kinh Doanh B02-DN
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Theo Thông tư 99/2025/TT-BTC - Niên độ kế toán năm {fiscalYear}
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
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
          >
            <Download size={14} />
            Xuất Excel
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Bảng KQKD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="p-3 w-20">Mã chỉ tiêu</th>
                <th className="p-3">Tên chỉ tiêu</th>
                <th className="p-3 w-36 text-right">Kỳ này</th>
                <th className="p-3 w-36 text-right">Lũy kế từ đầu năm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {REPORT_ITEMS.map((item, idx) => {
                const value = values[item.code] || 0;
                const isFormula = item.isFormula;
                const isNegative = ['11', '22', '23', '24', '25', '32', '51', '52'].includes(item.code);
                const displayValue = isNegative ? -Math.abs(value) : value;

                const rowClass = isFormula
                  ? (item.code === '20' ? 'bg-emerald-50/70 font-bold'
                    : item.code === '30' ? 'bg-blue-50/70 font-bold'
                    : item.code === '40' ? 'bg-purple-50/70 font-bold'
                    : item.code === '50' ? 'bg-amber-50/70 font-bold'
                    : item.code === '60' ? 'bg-slate-900 text-white font-black'
                    : 'bg-slate-50/50 font-bold')
                  : '';

                return (
                  <tr key={item.code} className={`hover:bg-slate-50/30 transition ${rowClass}`}>
                    <td className={`p-3 font-mono ${isFormula ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {item.code}
                    </td>
                    <td className={`p-3 ${isFormula ? 'font-bold' : ''}`}>
                      {item.name}
                    </td>
                    <td className={`p-3 text-right font-mono ${item.code === '60' ? 'text-white' : (displayValue < 0 ? 'text-rose-600' : '')}`}>
                      {formatCurrency(displayValue)}
                    </td>
                    <td className={`p-3 text-right font-mono ${item.code === '60' ? 'text-white' : (displayValue < 0 ? 'text-rose-600' : '')}`}>
                      {formatCurrency(displayValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tổng quan lợi nhuận */}
      <div className={`p-4 rounded-xl text-white shadow-md ${netProfit >= 0 ? 'bg-slate-900' : 'bg-rose-600'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              {netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              KẾT QUẢ KINH DOANH NĂM {fiscalYear}
            </h3>
            <p className="text-xs text-white/70 mt-1">
              {netProfit >= 0 
                ? 'Doanh nghiệp hoạt động có lãi' 
                : 'Doanh nghiệp đang trong tình trạng lỗ'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Lợi nhuận sau thuế</div>
            <div className="text-2xl font-black">{formatCurrency(netProfit)}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 border-t border-white/10 pt-3 text-xs">
          <div>
            <span className="text-white/60">Doanh thu thuần</span>
            <div className="font-bold text-white">{formatCurrency(values['10'] || 0)}</div>
          </div>
          <div>
            <span className="text-white/60">Lợi nhuận gộp</span>
            <div className="font-bold text-white">{formatCurrency(values['20'] || 0)}</div>
          </div>
          <div>
            <span className="text-white/60">Lợi nhuận trước thuế</span>
            <div className="font-bold text-white">{formatCurrency(values['50'] || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}