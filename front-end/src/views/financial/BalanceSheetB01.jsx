import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { FileText, CheckCircle2, AlertCircle, Download } from 'lucide-react';

// Bảng cân đối kế toán mẫu B01-DN theo Thông tư 99/2025/TT-BTC
const ACCOUNT_GROUPS = {
  assets: {
    title: 'A. TÀI SẢN NGẮN HẠN (100=110+120+130+140+150)',
    code: '1,2',
    accounts: [
      { code: '110', name: 'Tiền và tương đương tiền', type: 'debit', isTotal: true },
      { code: '111', name: '  Tiền mặt', type: 'debit', parentCode: '110' },
      { code: '112', name: '  Tiền gửi ngân hàng', type: 'debit', parentCode: '110' },
      { code: '120', name: 'Đầu tư tài chính ngắn hạn', type: 'debit', isTotal: true },
      { code: '121', name: '  Chứng khoán kinh doanh', type: 'debit', parentCode: '120' },
      { code: '128', name: '  Đầu tư nắm giữ đến ngày đáo hạn', type: 'debit', parentCode: '120' },
      { code: '130', name: 'Các khoản phải thu ngắn hạn', type: 'debit', isTotal: true },
      { code: '131', name: '  Phải thu khách hàng', type: 'hermaphroditic', parentCode: '130' },
      { code: '133', name: '  Thuế GTGT được khấu trừ', type: 'debit', parentCode: '130' },
      { code: '136', name: '  Phải thu nội bộ', type: 'debit', parentCode: '130' },
      { code: '138', name: '  Phải thu khác', type: 'debit', parentCode: '130' },
      { code: '141', name: '  Tạm ứng', type: 'debit', parentCode: '130' },
      { code: '140', name: 'Hàng tồn kho', type: 'debit', isTotal: true },
      { code: '151', name: '  Hàng mua đang đi đường', type: 'debit', parentCode: '140' },
      { code: '152', name: '  Nguyên liệu, vật liệu', type: 'debit', parentCode: '140' },
      { code: '153', name: '  Công cụ, dụng cụ', type: 'debit', parentCode: '140' },
      { code: '154', name: '  CPSX dở dang', type: 'debit', parentCode: '140' },
      { code: '155', name: '  Thành phẩm', type: 'debit', parentCode: '140' },
      { code: '156', name: '  Hàng hóa', type: 'debit', parentCode: '140' },
      { code: '157', name: '  Hàng gửi đi bán', type: 'debit', parentCode: '140' },
      { code: '150', name: 'Tài sản ngắn hạn khác', type: 'debit', isTotal: true },
      { code: '242', name: '  Chi phí trả trước ngắn hạn', type: 'debit', parentCode: '150' },
      { code: '200', name: 'B. TÀI SẢN DÀI HẠN (200=210+220+230+240+250+260)', type: 'debit', isTotal: true },
      { code: '211', name: '  Tài sản cố định hữu hình', type: 'debit', parentCode: '210' },
      { code: '213', name: '  Tài sản cố định vô hình', type: 'debit', parentCode: '210' },
      { code: '214', name: '  Hao mòn tài sản cố định', type: 'credit', parentCode: '210' },
      { code: '217', name: '  Bất động sản đầu tư', type: 'debit', parentCode: '220' },
      { code: '241', name: '  XDCB dở dang', type: 'debit', parentCode: '230' },
      { code: '244', name: '  Cầm cố, ký quỹ, ký cược dài hạn', type: 'debit', parentCode: '250' },
    ]
  },
  liabilities: {
    title: 'C. NỢ PHẢI TRẢ (300=310+320+330)',
    code: '3',
    accounts: [
      { code: '310', name: 'Nợ ngắn hạn', type: 'credit', isTotal: true },
      { code: '331', name: '  Phải trả người bán', type: 'hermaphroditic', parentCode: '310' },
      { code: '333', name: '  Thuế và các khoản phải nộp NN', type: 'credit', parentCode: '310' },
      { code: '334', name: '  Phải trả người lao động', type: 'credit', parentCode: '310' },
      { code: '336', name: '  Phải trả nội bộ', type: 'credit', parentCode: '310' },
      { code: '338', name: '  Phải trả, phải nộp khác', type: 'credit', parentCode: '310' },
      { code: '341', name: '  Vay và nợ thuê tài chính', type: 'credit', parentCode: '310' },
      { code: '320', name: 'Nợ dài hạn', type: 'credit', isTotal: true },
      { code: '352', name: '  Dự phòng phải trả dài hạn', type: 'credit', parentCode: '320' },
    ]
  },
  equity: {
    title: 'D. VỐN CHỦ SỞ HỮU (400=410+420+430)',
    code: '4',
    accounts: [
      { code: '410', name: 'Vốn chủ sở hữu', type: 'credit', isTotal: true },
      { code: '411', name: '  Vốn góp của chủ sở hữu', type: 'credit', parentCode: '410' },
      { code: '412', name: '  Chênh lệch đánh giá lại tài sản', type: 'credit', parentCode: '410' },
      { code: '414', name: '  Quỹ đầu tư phát triển', type: 'credit', parentCode: '410' },
      { code: '418', name: '  Các quỹ khác thuộc VCSH', type: 'credit', parentCode: '410' },
      { code: '419', name: '  Cổ phiếu quỹ', type: 'debit', parentCode: '410' },
      { code: '421', name: '  Lợi nhuận sau thuế chưa PP', type: 'credit', parentCode: '410' },
      { code: '430', name: 'Nguồn kinh phí, quỹ khác', type: 'credit', isTotal: true },
      { code: '353', name: '  Quỹ khen thưởng, phúc lợi', type: 'credit', parentCode: '430' },
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
  const reportRef = useRef(null);

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

    ACCOUNT_GROUPS.assets.accounts.forEach(acc => {
      const balance = getAccountBalance(data, acc.code, acc.type);
      if (!acc.isTotal) return;
      if (acc.code === '110') {
        totalAssets += Math.abs(balance);
      } else if (acc.code === '200') {
        totalAssets += Math.abs(balance);
      }
    });

    ACCOUNT_GROUPS.liabilities.accounts.forEach(acc => {
      if (!acc.isTotal) return;
      const balance = getAccountBalance(data, acc.code, acc.type);
      totalLiabilities += Math.abs(balance);
    });

    ACCOUNT_GROUPS.equity.accounts.forEach(acc => {
      if (!acc.isTotal) return;
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
    if (!data[accountCode]) {
      // Tính tổng cho các chỉ tiêu tổng hợp
      const children = findChildren(accountCode);
      if (children.length > 0) {
        let sum = 0;
        children.forEach(childCode => {
          sum += getDirectBalance(data, childCode);
        });
        return sum;
      }
      return 0;
    }
    return getDirectBalance(data, accountCode, accountType);
  };

  const getDirectBalance = (data, accountCode, accountType) => {
    if (!data[accountCode]) return 0;
    const { patsinhDr, patsinhCr } = data[accountCode];
    const balance = accountType === 'credit' ? patsinhCr - patsinhDr : patsinhDr - patsinhCr;
    return balance;
  };

  const findChildren = (parentCode) => {
    const children = [];
    for (const group of Object.values(ACCOUNT_GROUPS)) {
      group.accounts.forEach(acc => {
        if (acc.parentCode === parentCode) {
          children.push(acc.code);
        }
      });
    }
    return children;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const getDisplayBalance = (acc, data) => {
    const balance = getAccountBalance(data, acc.code, acc.type);
    const displayValue = Math.abs(balance);

    if (acc.type === 'debit' || acc.type === 'hermaphroditic') {
      return balance > 0 ? displayValue : 0;
    } else {
      return balance > 0 ? displayValue : 0;
    }
  };

  const getCreditBalance = (acc, data) => {
    const balance = getAccountBalance(data, acc.code, acc.type);
    const displayValue = Math.abs(balance);

    if (acc.type === 'credit' || acc.type === 'hermaphroditic') {
      return balance > 0 ? displayValue : 0;
    } else {
      return balance > 0 ? displayValue : 0;
    }
  };

  const handleExportExcel = () => {
    if (!reportRef.current) return;
    const table = reportRef.current.querySelector('table');
    if (!table) return;

    let csv = '\uFEFF';
    csv += 'BẢNG CÂN ĐỐI KẾ TOÁN B01-DN\n';
    csv += `Năm tài chính: ${fiscalYear}\n\n`;
    csv += 'Mã chỉ tiêu,Tên chỉ tiêu,Số cuối kỳ,Số đầu năm\n';

    for (const group of Object.values(ACCOUNT_GROUPS)) {
      csv += `\n${group.title},,,\n`;
      group.accounts.forEach(acc => {
        const debitBal = getDisplayBalance(acc, ledger);
        const creditBal = getDisplayBalance(acc, ledger);
        const displayValue = (acc.type === 'debit' || acc.type === 'hermaphroditic') ? debitBal : creditBal;
        csv += `${acc.code},"${acc.name}",${displayValue},0\n`;
      });
    }

    csv += '\n';
    csv += `Tổng Tài sản,,${formatCurrency(balanceData.totalAssets).replace(/[^0-9]/g, '')},0\n`;
    csv += `Tổng Nợ phải trả,,${formatCurrency(balanceData.totalLiabilities).replace(/[^0-9]/g, '')},0\n`;
    csv += `Tổng VCSH,,${formatCurrency(balanceData.totalEquity).replace(/[^0-9]/g, '')},0\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `B01-DN_${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            Bảng Cân Đối Kế Toán B01-DN
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Theo Thông tư 99/2025/TT-BTC - Ban hành ngày 15/6/2025
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
        </div>
      </div>

      {/* Bảng cân đối */}
      <div ref={reportRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="p-3 w-24">Mã chỉ tiêu</th>
                <th className="p-3">Tên chỉ tiêu</th>
                <th className="p-3 w-36 text-right">Số cuối kỳ</th>
                <th className="p-3 w-36 text-right">Số đầu năm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(ACCOUNT_GROUPS).map((group, gi) => (
                <React.Fragment key={gi}>
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2 text-slate-700" colSpan="4">{group.title}</td>
                  </tr>
                  {group.accounts.map((acc, ai) => {
                    const debitBal = getDisplayBalance(acc, ledger);
                    const creditBal = getCreditBalance(acc, ledger);
                    const displayValue = (acc.type === 'debit' || acc.type === 'hermaphroditic') ? debitBal : creditBal;
                    const isTotal = acc.isTotal;

                    if (displayValue === 0 && !isTotal) return null;

                    return (
                      <tr key={ai} className={`hover:bg-slate-50/30 transition ${isTotal ? 'font-bold bg-slate-50/50' : ''} ${acc.parentCode ? '' : ''}`}>
                        <td className={`p-3 font-mono ${isTotal ? 'text-indigo-700' : 'text-blue-600'}`}>
                          {acc.code}
                        </td>
                        <td className={`p-3 text-slate-600 ${isTotal ? 'font-bold' : ''}`}>
                          {acc.name}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {displayValue > 0 ? formatCurrency(displayValue) : '—'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">—</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tổng hợp */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Tổng Tài sản (A+B):</span>
              <span className="ml-2 font-black text-emerald-700">{formatCurrency(balanceData.totalAssets)}</span>
            </div>
            <div>
              <span className="text-slate-500">Tổng Nợ phải trả (C):</span>
              <span className="ml-2 font-black text-amber-700">{formatCurrency(balanceData.totalLiabilities)}</span>
            </div>
            <div>
              <span className="text-slate-500">Tổng VCSH (D):</span>
              <span className="ml-2 font-black text-purple-700">{formatCurrency(balanceData.totalEquity)}</span>
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
              ? '✓ Bảng cân đối kế toán cân đối - Tài sản = Nợ phải trả + VCSH' 
              : `✗ Lệch sổ sách: ${formatCurrency(Math.abs(balanceData.totalAssets - (balanceData.totalLiabilities + balanceData.totalEquity)))}`
            }
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Công thức kế toán</div>
          <div className="text-sm font-black">
            {formatCurrency(balanceData.totalAssets)} = {formatCurrency(balanceData.totalLiabilities + balanceData.totalEquity)}
          </div>
        </div>
      </div>
    </div>
  );
}