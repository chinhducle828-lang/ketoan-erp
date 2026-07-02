import React, { useState, useEffect, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { calculateBalances } from '../../utils/accountingEngine'; 
import { Save, Plus, Trash2, CheckCircle, AlertTriangle, Layers, Folder } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

// Từ điển danh mục tài khoản chuẩn phục vụ hiển thị tên gọi
const ACCOUNT_DICTIONARY = {
  '111': 'Tiền mặt',
  '112': 'Tiền gửi Ngân hàng',
  '131': 'Phải thu của khách hàng (Lưỡng tính)',
  '138': 'Phải thu khác (Lưỡng tính)',
  '152': 'Nguyên liệu, vật liệu',
  '153': 'Công cụ, dụng cụ',
  '156': 'Hàng hóa',
  '211': 'Tài sản cố định hữu hình',
  '214': 'Hao mòn tài sản cố định (Ghi âm)',
  '215': 'Tài sản sinh học',
  '331': 'Phải trả cho người bán (Lưỡng tính)',
  '333': 'Thuế và các khoản phải nộp Nhà nước',
  '334': 'Phải trả người lao động (Lưỡng tính)',
  '338': 'Phải trả, phải nộp khác (Lưỡng tính)',
  '411': 'Vốn đầu tư của chủ sở hữu',
  '421': 'Lợi nhuận sau thuế chưa phân phối'
};

// Định nghĩa danh sách các tài khoản có tính chất lưỡng tính
const DUAL_NATURE_ACCOUNTS = ['131', '138', '331', '334', '338'];

export default function OpeningBalances() {
  const { vouchers, fetchVouchers } = useVouchers();
  const { fiscalYear } = useAuth(); 
  
  const currentCompanyId = vouchers[0]?.companyId || localStorage.getItem('current_company_id') || '';
  const defaultCodes = ['111', '112', '131', '152', '156', '211', '214', '215', '331', '333', '334', '411', '421'];
  
  const [activeAccountCodes, setActiveAccountCodes] = useState(defaultCodes);
  const [balances, setBalances] = useState({});
  const [selectedNewCode, setSelectedNewCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Hàm format hiển thị số tài chính: Số âm hoặc giảm trừ dạng (Số tiền)
  const formatFinancialNumber = (num) => {
    if (!num && num !== 0) return '0 đ';
    const roundedNum = Math.round(num);
    if (roundedNum < 0) {
      return `(${Math.abs(roundedNum).toLocaleString('vi-VN')}) đ`;
    }
    return `${roundedNum.toLocaleString('vi-VN')} đ`;
  };

  // Đồng bộ số liệu từ database thông qua Accounting Engine
  useEffect(() => {
    if (vouchers && vouchers.length > 0) {
      const ledger = calculateBalances(vouchers);
      const initialBalances = {};
      const foundCodes = [...defaultCodes];

      Object.keys(ledger).forEach(code => {
        if (ledger[code]?.openingDr > 0 || ledger[code]?.openingCr > 0) {
          if (!foundCodes.includes(code)) foundCodes.push(code);
        }
      });

      setActiveAccountCodes(foundCodes);

      foundCodes.forEach(code => {
        initialBalances[code] = {
          dr: ledger[code]?.openingDr > 0 ? ledger[code].openingDr.toString() : '',
          cr: ledger[code]?.openingCr > 0 ? ledger[code].openingCr.toString() : ''
        };
      });
      setBalances(initialBalances);
    } else {
      const emptyBalances = {};
      defaultCodes.forEach(code => {
        emptyBalances[code] = { dr: '', cr: '' };
      });
      setBalances(emptyBalances);
    }
  }, [vouchers]);

  const handleInputChange = (code, side, value) => {
    setBalances(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        [side]: value
      }
    }));
  };

  const handleAddAccount = () => {
    if (!selectedNewCode) return;
    if (activeAccountCodes.includes(selectedNewCode)) {
      setMessage('⚠️ Tài khoản này đã tồn tại trong danh sách nhập liệu!');
      return;
    }
    setActiveAccountCodes(prev => [...prev, selectedNewCode]);
    setBalances(prev => ({ ...prev, [selectedNewCode]: { dr: '', cr: '' } }));
    setSelectedNewCode('');
    setMessage('✓ Đã thêm tài khoản mới vào cấu trúc thành công.');
  };

  const handleRemoveAccount = (code) => {
    if (defaultCodes.includes(code)) {
      alert('Không thể xóa tài khoản mặc định thuộc cấu trúc báo cáo!');
      return;
    }
    setActiveAccountCodes(prev => prev.filter(c => c !== code));
    setBalances(prev => {
      const updated = { ...prev };
      delete updated[code];
      return updated;
    });
  };

  // PHÂN CHIA TÀI KHOẢN THEO ĐÚNG CẤU TRÚC 2 MẢNG LỚN - 4 NHÓM DANH MỤC CON
  const financialStructure = useMemo(() => {
    const assetShort = []; // Tài sản ngắn hạn (Đầu 1)
    const assetLong = [];  // Tài sản dài hạn (Đầu 2)
    const liabilities = []; // Nợ phải trả (Đầu 3)
    const equity = [];      // Vốn chủ sở hữu (Đầu 4)

    activeAccountCodes.forEach(code => {
      const isDual = DUAL_NATURE_ACCOUNTS.includes(code);
      const accountData = {
        code,
        name: ACCOUNT_DICTIONARY[code] || 'Tài khoản bổ sung',
        isDual,
        defaultSide: ['214', '331', '333', '334', '338', '411', '421'].includes(code) ? 'Có (CR)' : 'Nợ (DR)'
      };

      if (code.startsWith('1')) assetShort.push(accountData);
      else if (code.startsWith('2')) assetLong.push(accountData);
      else if (code.startsWith('3')) liabilities.push(accountData);
      else if (code.startsWith('4')) equity.push(accountData);
    });

    const sortFn = (a, b) => a.code.localeCompare(b.code);
    return {
      assetShort: assetShort.sort(sortFn),
      assetLong: assetLong.sort(sortFn),
      liabilities: liabilities.sort(sortFn),
      equity: equity.sort(sortFn),
    };
  }, [activeAccountCodes]);

  // Kiểm tra tính cân đối tổng lực (Tổng Số dư Nợ = Tổng Số dư Có đầu kỳ)
  const checkBalanceTotals = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    Object.keys(balances).forEach(code => {
      totalDr += parseFloat(balances[code]?.dr) || 0;
      totalCr += parseFloat(balances[code]?.cr) || 0;
    });
    return {
      totalDr,
      totalCr,
      isBalanced: Math.round(totalDr) === Math.round(totalCr)
    };
  }, [balances]);

  const saveOpeningBalances = async () => {
    if (!checkBalanceTotals.isBalanced) {
      return setMessage('❌ Hệ thống từ chối lưu! Tổng số dư bên Nợ phải bằng Tổng số dư bên Có.');
    }
    setLoading(true);
    setMessage('');

    const flattenedBalances = {};
    Object.keys(balances).forEach(code => {
      const dr = Math.round(parseFloat(balances[code]?.dr) || 0);
      const cr = Math.round(parseFloat(balances[code]?.cr) || 0);
      
      if (DUAL_NATURE_ACCOUNTS.includes(code)) {
        if (dr > 0) flattenedBalances[`${code}_DR`] = dr;
        if (cr > 0) flattenedBalances[`${code}_CR`] = cr;
      } else {
        const val = dr > 0 ? dr : cr;
        if (val > 0) flattenedBalances[code] = val;
      }
    });

    try {
      const response = await fetch('/api/vouchers/opening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyId: currentCompanyId, 
          year: fiscalYear || 2026, 
          balances: flattenedBalances,
          isAdvancedStructure: true 
        })
      });
      const result = await response.json();
      if (result.success) {
        setMessage('🎉 Đã cập nhật và lưu trữ số dư đầu kỳ thành công!');
        if (fetchVouchers) fetchVouchers();
      } else {
        setMessage(`❌ Lỗi: ${result.error}`);
      }
    } catch (err) { 
      setMessage('⚠️ Lỗi kết nối máy chủ dữ liệu.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // Hàm render dùng chung cho từng tiểu mục bảng
  const renderSubsectionTable = (accounts, title, codeColor) => (
    <div className="mb-4 last:mb-0">
      <div className="bg-slate-50/60 px-3 py-1.5 border-b border-slate-100 flex items-center gap-1.5">
        <Folder size={12} className="text-slate-400" />
        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <table className="w-full text-left border-collapse text-xs">
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {accounts.map(acc => {
            const hasCrValue = parseFloat(balances[acc.code]?.cr) > 0;
            // Áp dụng định dạng ngoặc đơn (hao mòn) cho TK 214 hoặc tài khoản phát sinh Có thuộc mảng Tài sản
            const useParenthesesForCr = acc.code === '214' || (acc.code.startsWith('1') || acc.code.startsWith('2') ? hasCrValue : false);

            return (
              <tr key={acc.code} className="hover:bg-slate-50/30 transition">
                <td className={`p-3 w-16 font-mono font-bold ${codeColor}`}>{acc.code}</td>
                <td className="p-3 text-slate-600 font-semibold truncate max-w-[140px] md:max-w-none" title={acc.name}>{acc.name}</td>
                
                {/* Dư Nợ */}
                <td className="p-2 w-32">
                  {(acc.isDual || acc.defaultSide === 'Có (CR)' === false) ? (
                    <input 
                      type="number" 
                      placeholder="0"
                      value={balances[acc.code]?.dr || ''}
                      onChange={e => handleInputChange(acc.code, 'dr', e.target.value)}
                      className="w-full p-1.5 text-right bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-sky-500 font-mono font-bold text-blue-700 text-xs"
                    />
                  ) : (
                    <div className="text-right text-slate-300 pr-4 font-mono select-none">-</div>
                  )}
                </td>

                {/* Dư Có */}
                <td className="p-2 w-32">
                  {(acc.isDual || acc.defaultSide === 'Có (CR)' || acc.code === '214') ? (
                    <input 
                      type="number" 
                      placeholder={useParenthesesForCr ? "(0)" : "0"}
                      value={balances[acc.code]?.cr || ''}
                      onChange={e => handleInputChange(acc.code, 'cr', e.target.value)}
                      className={`w-full p-1.5 text-right bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono font-bold text-xs ${
                        useParenthesesForCr ? 'text-rose-600 border-rose-100 bg-rose-50/20' : 'text-amber-700'
                      }`}
                    />
                  ) : (
                    <div className="text-right text-slate-300 pr-4 font-mono select-none">-</div>
                  )}
                </td>

                {/* Xóa TK thủ công */}
                <td className="p-3 w-8 text-center">
                  {!defaultCodes.includes(acc.code) && (
                    <button onClick={() => handleRemoveAccount(acc.code)} className="text-slate-300 hover:text-rose-600 transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto p-4">
      {/* Tiêu đề điều hướng */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-sky-600" size={20} />
            Khai báo Số dư đầu kỳ — Năm {fiscalYear || 2026}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Sắp xếp phân nhóm Báo cáo tài chính (Tài sản ngắn/dài hạn & Nợ phải trả/Vốn chủ sở hữu)</p>
        </div>
        
        {/* Chọn thêm tài khoản thủ công */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={selectedNewCode}
            onChange={e => setSelectedNewCode(e.target.value)}
            className="text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-sky-500 flex-1 md:w-64"
          >
            <option value="">-- Thêm tài khoản thủ công --</option>
            <option value="138">138 - Phải thu khác (Tài sản ngắn hạn)</option>
            <option value="153">153 - Công cụ, dụng cụ (Tài sản ngắn hạn)</option>
            <option value="338">338 - Phải trả khác (Nợ phải trả)</option>
          </select>
          <button
            onClick={handleAddAccount}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1 transition shadow-sm"
          >
            <Plus size={14} /> Thêm
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold border ${
          message.startsWith('🎉') || message.startsWith('✓')
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
            : 'bg-rose-50 text-rose-700 border-rose-100'
        }`}>
          {message}
        </div>
      )}

      {/* BẢNG CHIA THEO HAI MẢNG LỚN: TÀI SẢN & VỐN (NGUỒN VỐN) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* MẢNG 1: TÀI SẢN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-xs uppercase tracking-wider">A. TÀI SẢN</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Mã đầu 1 & 2</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs border-b border-slate-100">
              <thead>
                <tr className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                  <th className="p-3 w-16">Mã TK</th>
                  <th className="p-3">Tên tài khoản kế toán</th>
                  <th className="p-3 w-32 text-right">Số dư Nợ (DR)</th>
                  <th className="p-3 w-32 text-right">Số dư Có (CR)</th>
                  <th className="p-3 w-8 text-center"></th>
                </tr>
              </thead>
            </table>
            {renderSubsectionTable(financialStructure.assetShort, "I. Tài sản ngắn hạn", "text-blue-600")}
            {renderSubsectionTable(financialStructure.assetLong, "II. Tài sản dài hạn", "text-indigo-600")}
          </div>
        </div>

        {/* MẢNG 2: VỐN (NGUỒN VỐN) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-xs uppercase tracking-wider">B. NGUỒN VỐN</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Mã đầu 3 & 4</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs border-b border-slate-100">
              <thead>
                <tr className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                  <th className="p-3 w-16">Mã TK</th>
                  <th className="p-3">Tên tài khoản kế toán</th>
                  <th className="p-3 w-32 text-right">Số dư Nợ (DR)</th>
                  <th className="p-3 w-32 text-right">Số dư Có (CR)</th>
                  <th className="p-3 w-8 text-center"></th>
                </tr>
              </thead>
            </table>
            {renderSubsectionTable(financialStructure.liabilities, "I. Nợ phải trả", "text-amber-600")}
            {renderSubsectionTable(financialStructure.equity, "II. Vốn chủ sở hữu", "text-emerald-600")}
          </div>
        </div>

      </div>

      {/* ĐỐI CHIẾU CÂN ĐỐI TỔNG LỰC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số dư Nợ (Tổng DR)</span>
          <h3 className="text-base font-black text-blue-700 mt-0.5">{formatFinancialNumber(checkBalanceTotals.totalDr)}</h3>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số dư Có (Tổng CR)</span>
          <h3 className="text-base font-black text-amber-700 mt-0.5">{formatFinancialNumber(checkBalanceTotals.totalCr)}</h3>
        </div>
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          checkBalanceTotals.isBalanced 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">Đối chiếu cân đối hạch toán</span>
            <span className="text-xs font-black flex items-center gap-1 mt-0.5 font-mono">
              {checkBalanceTotals.isBalanced ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {checkBalanceTotals.isBalanced 
                ? 'CÂN ĐỐI HOÀN HẢO' 
                : `LỆCH: ${formatFinancialNumber(Math.abs(checkBalanceTotals.totalDr - checkBalanceTotals.totalCr))}`
              }
            </span>
          </div>
          <button
            onClick={saveOpeningBalances}
            disabled={loading || !checkBalanceTotals.isBalanced}
            className={`font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-sm ${
              checkBalanceTotals.isBalanced 
                ? 'bg-sky-600 hover:bg-sky-700 text-white' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save size={14} /> {loading ? 'Đang lưu...' : 'Lưu số dư'}
          </button>
        </div>
      </div>
    </div>
  );
}