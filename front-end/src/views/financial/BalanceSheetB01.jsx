import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculateBalances, getTotalDebit, getTotalCredit } from '../../utils/accountingEngine.js';
import { FileText, Layers, RefreshCw, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

// Bảng cân đối kế toán mẫu B01-DN
const ACCOUNT_GROUPS = {
  assets: {
    title: 'A. TÀI SẢN',
    code: '1,2',
    accounts: [
      { code: '111', name: 'Tiền mặt', type: 'debit' },
      { code: '112', name: 'Tiền gửi ngân hàng', type: 'debit' },
      { code: '121', name: 'Chứng khoán', type: 'debit' },
      { code: '128', name: 'Đầu tư nắm giữ', type: 'debit' },
      { code: '131', name: 'Phải thu khách hàng', type: 'hermaphroditic' },
      { code: '133', name: 'Thuế GTGT được khấu trừ', type: 'debit' },
      { code: '136', name: 'Phải thu nội bộ', type: 'debit' },
      { code: '138', name: 'Tài sản thiếu', type: 'debit' },
      { code: '141', name: 'Tạm ứng', type: 'debit' },
      { code: '151', name: 'Hàng mua đang đi đường', type: 'debit' },
      { code: '152', name: 'Nguyên liệu, vật liệu tồn kho', type: 'debit' },
      { code: '153', name: 'Công cụ, dụng cụ tồn kho', type: 'debit' },
      { code: '154', name: 'Chi phí sản xuất dở dang', type: 'debit' },
      { code: '155', name: 'Thành phẩm tồn kho', type: 'debit' },
      { code: '156', name: 'Hàng hóa tồn kho', type: 'debit' },
      { code: '157', name: 'Hàng gửi đi bán', type: 'debit' },
      { code: '211', name: 'Tài sản cố định hữu hình', type: 'debit' },
      { code: '213', name: 'Tài sản cố định vô hình', type: 'debit' },
      { code: '214', name: 'Hao mòn tài sản cố định', type: 'credit' },
      { code: '215', name: 'Tài sản sinh học', type: 'debit' },
      { code: '217', name: 'Bất động sản đầu tư', type: 'debit' },
      { code: '2295', name: 'Dự phòng tổn thất tài sản nông nghiệp', type: 'credit' },
      { code: '241', name: 'Xây dựng cơ bản dở dang', type: 'debit' },
      { code: '242', name: 'Chi phí trả trước', type: 'debit' },
      { code: '244', name: 'Cầm cố, ký quỹ, ký cược', type: 'debit' },
    ]
  },
  liabilities: {
    title: 'B. NỢ PHẢI TRẢ',
    code: '3',
    accounts: [
      { code: '331', name: 'Phải trả người bán', type: 'hermaphroditic' },
      { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', type: 'credit' },
      { code: '334', name: 'Phải trả người lao động', type: 'credit' },
      { code: '335', name: 'Chi phí phải trả', type: 'credit' },
      { code: '336', name: 'Phải trả nội bộ', type: 'credit' },
      { code: '338', name: 'Phải trả, phải nộp khác', type: 'credit' },
      { code: '341', name: 'Vay và nợ thuê tài chính', type: 'credit' },
      { code: '352', name: 'Dự phòng phải trả', type: 'credit' },
      { code: '353', name: 'Quỹ khen thưởng, phúc lợi', type: 'credit' },
    ]
  },
  equity: {
    title: 'C. VỐN CHỦ SỞ HỮU',
    code: '4',
    accounts: [
      { code: '411', name: 'Vốn góp của chủ sở hữu', type: 'credit' },
      { code: '412', name: 'Chênh lệch đánh giá lại tài sản', type: 'credit' },
      { code: '414', name: 'Quỹ đầu tư phát triển', type: 'credit' },
      { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', type: 'credit' },
      { code: '419', name: 'Cổ phiếu quỹ', type: 'credit' },
      { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', type: 'credit' },
    ]
  }
};

export default function BalanceSheetB01() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({});
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());
  const [balanceData, setBalanceData] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    isBalanced: true
  });

  useEffect(() => {
    if (activeCompany) {
      fetchBalanceSheet();
    }
  }, [activeCompany, fiscalYear]);

  const fetchBalanceSheet = async () => {
    if (!activeCompany) return;
    
    setLoading(true);
    try {
      const companyId = activeCompany.id || activeCompany;
const response = await api.get(`/api/report/balance-sheet?company_id=${companyId}&year=${fiscalYear}`);
      
      if (response.data?.success && response.data.data) {
        setLedger(response.data.data);
        calculateTotals(response.data.data);
      }
    } catch (error) {
      console.error('Lỗi tải bảng cân đối:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (data) => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Tính tổng tài sản
    ACCOUNT_GROUPS.assets.accounts.forEach(acc => {
      const balance = getAccountBalance(data, acc.code, acc.type);
      if (acc.type === 'credit') {
        // Tài khoản hao mòn, dự phòng - trừ vào tài sản
        totalAssets -= Math.abs(balance);
      } else {
        totalAssets += Math.abs(balance);
      }
    });

    // Tính tổng nợ phải trả
    ACCOUNT_GROUPS.liabilities.accounts.forEach(acc => {
      const balance = getAccountBalance(data, acc.code, acc.type);
      totalLiabilities += Math.abs(balance);
    });

    // Tính tổng vốn chủ sở hữu
    ACCOUNT_GROUPS.equity.accounts.forEach(acc => {
      const balance = getAccountBalance(data, acc.code, acc.type);
      totalEquity += Math.abs(balance);
    });

    setBalanceData({
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    });
  };

  const getAccountBalance = (data, accountCode, accountType) => {
    if (!data[accountCode]) return 0;
    
    const { patsinhDr, patsinhCr } = data[accountCode];
    
    if (accountType === 'hermaphroditic') {
      return patsinhDr - patsinhCr;
    }
    
    if (accountType === 'debit') {
      return patsinhDr - patsinhCr;
    } else {
      return patsinhCr - patsinhDr;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const renderAccountRow = (acc, data) => {
    const balance = getAccountBalance(data, acc.code, acc.type);
    const displayValue = Math.abs(balance);
    
    if (displayValue === 0) return null;

    return (
      <tr key={acc.code} className="hover:bg-slate-50/30 transition">
        <td className="p-3 font-mono text-blue-600">{acc.code}</td>
        <td className="p-3 text-slate-600">{acc.name}</td>
        <td className="p-3 text-right font-mono">
          {acc.type === 'debit' || acc.type === 'hermaphroditic' ? (
            balance > 0 ? formatCurrency(balance) : '—'
          ) : (
            balance < 0 ? formatCurrency(Math.abs(balance)) : '—'
          )}
        </td>
        <td className="p-3 text-right font-mono">
          {acc.type === 'debit' || acc.type === 'hermaphroditic' ? (
            balance < 0 ? formatCurrency(Math.abs(balance)) : '—'
          ) : (
            balance > 0 ? formatCurrency(balance) : '—'
          )}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Đang tính toán bảng cân đối kế toán...</p>
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
            <FileText className="text-emerald-600" size={24} />
            Báo Cáo Tài Chính Mẫu B01-DN
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Bảng cân đối kế toán theo Thông tư 99/2025/TT-BTC
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

      {/* Tài sản */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wider">A. TÀI SẢN</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b font-bold text-slate-500">
                <th className="p-3 w-20">Mã TK</th>
                <th className="p-3">Tên tài khoản</th>
                <th className="p-3 w-40 text-right">Số dư Nợ</th>
                <th className="p-3 w-40 text-right">Số dư Có</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ACCOUNT_GROUPS.assets.accounts.map(acc => renderAccountRow(acc, ledger))}
            </tbody>
          </table>
        </div>
        <div className="bg-emerald-50/70 px-4 py-3 border-t border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-700 uppercase">Tổng tài sản</span>
            <span className="text-sm font-black text-emerald-700">
              {formatCurrency(balanceData.totalAssets)}
            </span>
          </div>
        </div>
      </div>

      {/* Nợ phải trả & Vốn chủ sở hữu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">B. NỢ PHẢI TRẢ</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b font-bold text-slate-500">
                  <th className="p-3 w-20">Mã TK</th>
                  <th className="p-3">Tên tài khoản</th>
                  <th className="p-3 w-40 text-right">Số dư Có</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ACCOUNT_GROUPS.liabilities.accounts.map(acc => {
                  const balance = getAccountBalance(ledger, acc.code, acc.type);
                  if (Math.abs(balance) === 0) return null;
                  return (
                    <tr key={acc.code} className="hover:bg-slate-50/30 transition">
                      <td className="p-3 font-mono text-amber-600">{acc.code}</td>
                      <td className="p-3 text-slate-600">{acc.name}</td>
                      <td className="p-3 text-right font-mono">
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-50/70 px-4 py-3 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-700 uppercase">Tổng nợ phải trả</span>
              <span className="text-sm font-black text-amber-700">
                {formatCurrency(balanceData.totalLiabilities)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-800 text-white px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">C. VỐN CHỦ SỞ HỮU</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b font-bold text-slate-500">
                  <th className="p-3 w-20">Mã TK</th>
                  <th className="p-3">Tên tài khoản</th>
                  <th className="p-3 w-40 text-right">Số dư Có</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ACCOUNT_GROUPS.equity.accounts.map(acc => {
                  const balance = getAccountBalance(ledger, acc.code, acc.type);
                  if (Math.abs(balance) === 0) return null;
                  return (
                    <tr key={acc.code} className="hover:bg-slate-50/30 transition">
                      <td className="p-3 font-mono text-purple-600">{acc.code}</td>
                      <td className="p-3 text-slate-600">{acc.name}</td>
                      <td className="p-3 text-right font-mono">
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-purple-50/70 px-4 py-3 border-t border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-purple-700 uppercase">Tổng vốn chủ sở hữu</span>
              <span className="text-sm font-black text-purple-700">
                {formatCurrency(balanceData.totalEquity)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kiểm tra cân đối */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        balanceData.isBalanced 
          ? 'bg-emerald-50 border-emerald-200' 
          : 'bg-rose-50 border-rose-200'
      }`}>
        <div className="flex items-center gap-2">
          {balanceData.isBalanced ? (
            <CheckCircle2 className="text-emerald-600" size={20} />
          ) : (
            <AlertCircle className="text-rose-600" size={20} />
          )}
          <span className={`text-sm font-bold ${
            balanceData.isBalanced ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {balanceData.isBalanced 
              ? 'Bảng cân đối kế toán cân đối' 
              : `Lệch sổ sách: ${formatCurrency(Math.abs(balanceData.totalAssets - (balanceData.totalLiabilities + balanceData.totalEquity)))}`
            }
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Tài sản = Nợ + Vốn</div>
          <div className="text-sm font-black">
            {formatCurrency(balanceData.totalAssets)} = {formatCurrency(balanceData.totalLiabilities + balanceData.totalEquity)}
          </div>
        </div>
      </div>
    </div>
  );
}