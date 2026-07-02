import React, { useState, useEffect, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { calculateBalances } from '../../utils/accountingEngine'; 
import { Save, Plus, Trash2, CheckCircle, AlertTriangle, Layers, Folder, PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const ACCOUNT_DICTIONARY = {
  '111': 'Tiền mặt',
  '112': 'Tiền gửi Ngân hàng',
  '131': 'Phải thu của khách hàng (Lưỡng tính)',
  '138': 'Phải thu khác (Lưỡng tính)',
  '141': 'Tạm ứng',
  '152': 'Nguyên liệu, vật liệu',
  '153': 'Công cụ, dụng cụ',
  '156': 'Hàng hóa',
  '211': 'Tài sản cố định hữu hình',
  '214': 'Hao mòn tài sản cố định (Ghi âm)',
  '215': 'Tài sản sinh học',
  '229': 'Dự phòng tổn thất tài sản (Ghi âm)',
  '331': 'Phải trả cho người bán (Lưỡng tính)',
  '333': 'Thuế và các khoản phải nộp Nhà nước',
  '334': 'Phải trả người lao động (Lưỡng tính)',
  '338': 'Phải trả, phải nộp khác (Lưỡng tính)',
  '341': 'Vay và nợ thuê tài chính',
  '411': 'Vốn đầu tư của chủ sở hữu',
  '418': 'Quỹ đầu tư phát triển',
  '421': 'Lợi nhuận sau thuế chưa phân phối'
};

const DUAL_NATURE_ACCOUNTS = ['131', '138', '141', '331', '334', '338'];

export default function OpeningBalances() {
  const { vouchers, fetchVouchers } = useVouchers();
  const { fiscalYear } = useAuth(); 
  
  const currentCompanyId = vouchers[0]?.companyId || localStorage.getItem('current_company_id') || '';
  const defaultCodes = ['111', '112', '131', '152', '156', '211', '214', '215', '331', '333', '334', '411', '421'];
  
  const [activeAccountCodes, setActiveAccountCodes] = useState(defaultCodes);
  const [balances, setBalances] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Lưu trữ dữ liệu tạm thời của dòng nhập thủ công cho từng khối (Key đại diện cho tiền tố đầu mã: '1', '2', '3', '4')
  const [inlineInputs, setInlineInputs] = useState({
    '1': { code: '', name: '' },
    '2': { code: '', name: '' },
    '3': { code: '', name: '' },
    '4': { code: '', name: '' }
  });

  const formatFinancialNumber = (num) => {
    if (!num && num !== 0) return '0 đ';
    const roundedNum = Math.round(num);
    if (roundedNum < 0) return `(${Math.abs(roundedNum).toLocaleString('vi-VN')}) đ`;
    return `${roundedNum.toLocaleString('vi-VN')} đ`;
  };

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
      defaultCodes.forEach(code => { emptyBalances[code] = { dr: '', cr: '' }; });
      setBalances(emptyBalances);
    }
  }, [vouchers]);

  const handleInputChange = (code, side, value) => {
    setBalances(prev => ({
      ...prev,
      [code]: { ...prev[code], [side]: value }
    }));
  };

  // Hàm xử lý khi thay đổi ô Input nhập tay nhanh mã tài khoản
  const handleInlineCodeChange = (blockId, codeValue) => {
    const cleanedCode = codeValue.replace(/\D/g, ''); // Chỉ cho phép nhập số
    const autoName = ACCOUNT_DICTIONARY[cleanedCode] || '';
    setInlineInputs(prev => ({
      ...prev,
      [blockId]: { code: cleanedCode, name: autoName }
    }));
  };

  const handleInlineNameChange = (blockId, nameValue) => {
    setInlineInputs(prev => ({
      ...prev,
      [blockId]: { ...prev[blockId], name: nameValue }
    }));
  };

  // Thêm trực tiếp tài khoản từ dòng Inline Form
  const handleAddInlineAccount = (blockId) => {
    const { code, name } = inlineInputs[blockId];
    if (!code || code.length < 3) {
      alert('Mã tài khoản phải có ít nhất 3 chữ số!');
      return;
    }
    if (!code.startsWith(blockId)) {
      alert(`Mã tài khoản phải bắt đầu bằng đầu số ${blockId} để phù hợp với phân nhóm này!`);
      return;
    }
    if (activeAccountCodes.includes(code)) {
      alert('Tài khoản này đã tồn tại trong danh sách!');
      return;
    }

    // Cập nhật từ điển tạm thời nếu kế toán tự đặt tên mới
    if (name && !ACCOUNT_DICTIONARY[code]) {
      ACCOUNT_DICTIONARY[code] = name;
    }

    setActiveAccountCodes(prev => [...prev, code]);
    setBalances(prev => ({ ...prev, [code]: { dr: '', cr: '' } }));
    // Reset dòng nhập liệu của khối đó
    setInlineInputs(prev => ({ ...prev, [blockId]: { code: '', name: '' } }));
    setMessage(`✓ Đã kích hoạt nhập liệu cho tài khoản ${code} thành công.`);
  };

  const handleRemoveAccount = (code) => {
    if (defaultCodes.includes(code)) {
      alert('Không thể xóa tài khoản mặc định thuộc cấu trúc hệ thống!');
      return;
    }
    setActiveAccountCodes(prev => prev.filter(c => c !== code));
    setBalances(prev => {
      const updated = { ...prev };
      delete updated[code];
      return updated;
    });
  };

  const financialStructure = useMemo(() => {
    const assetShort = []; const assetLong = []; const liabilities = []; const equity = [];
    activeAccountCodes.forEach(code => {
      const isDual = DUAL_NATURE_ACCOUNTS.includes(code);
      const accountData = {
        code,
        name: ACCOUNT_DICTIONARY[code] || 'Tài khoản bổ sung',
        isDual,
        defaultSide: ['214', '229', '331', '333', '334', '338', '411', '421'].includes(code) ? 'Có (CR)' : 'Nợ (DR)'
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

  const checkBalanceTotals = useMemo(() => {
    let totalDr = 0; let totalCr = 0;
    Object.keys(balances).forEach(code => {
      totalDr += parseFloat(balances[code]?.dr) || 0;
      totalCr += parseFloat(balances[code]?.cr) || 0;
    });
    return { totalDr, totalCr, isBalanced: Math.round(totalDr) === Math.round(totalCr) };
  }, [balances]);

  const saveOpeningBalances = async () => {
    if (!checkBalanceTotals.isBalanced) {
      return setMessage('❌ Hệ thống từ chối lưu! Tổng số dư bên Nợ phải bằng Tổng số dư bên Có.');
    }
    setLoading(true); setMessage('');
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
        body: JSON.stringify({ companyId: currentCompanyId, year: fiscalYear || 2026, balances: flattenedBalances, isAdvancedStructure: true })
      });
      const result = await response.json();
      if (result.success) {
        setMessage('🎉 Đã lưu trữ số dư đầu kỳ thành công!');
        if (fetchVouchers) fetchVouchers();
      } else setMessage(`❌ Lỗi: ${result.error}`);
    } catch (err) { setMessage('⚠️ Lỗi kết nối máy chủ dữ liệu.'); } 
    finally { setLoading(false); }
  };

  // Render bảng con tích hợp dòng thêm thủ công Inline thông minh
  const renderSubsectionTable = (accounts, title, codeColor, blockId, placeholderCode) => (
    <div className="mb-5 last:mb-0">
      <div className="bg-slate-50/80 px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
        <Folder size={12} className="text-slate-400" />
        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <table className="w-full text-left border-collapse text-xs">
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {accounts.map(acc => {
            const hasCrValue = parseFloat(balances[acc.code]?.cr) > 0;
            const isAssetNegative = acc.code === '214' || acc.code === '229';
            const useParenthesesForCr = isAssetNegative || (acc.code.startsWith('1') || acc.code.startsWith('2') ? hasCrValue : false);

            return (
              <tr key={acc.code} className="hover:bg-slate-50/30 transition">
                <td className={`p-3 w-16 font-mono font-bold ${codeColor}`}>{acc.code}</td>
                <td className="p-3 text-slate-500 font-semibold truncate max-w-[140px] md:max-w-none">{acc.name}</td>
                
                {/* Dư Nợ */}
                <td className="p-2 w-32">
                  {(acc.isDual || acc.defaultSide === 'Có (CR)' === false) ? (
                    <input 
                      type="number" placeholder="0" value={balances[acc.code]?.dr || ''}
                      onChange={e => handleInputChange(acc.code, 'dr', e.target.value)}
                      className="w-full p-1.5 text-right bg-slate-50/60 border border-slate-100 rounded-lg focus:outline-none focus:border-sky-500 font-mono font-bold text-blue-700 text-xs"
                    />
                  ) : (
                    <div className="text-right text-slate-300 pr-4 font-mono select-none">-</div>
                  )}
                </td>

                {/* Dư Có */}
                <td className="p-2 w-32">
                  {(acc.isDual || acc.defaultSide === 'Có (CR)' || isAssetNegative) ? (
                    <input 
                      type="number" placeholder={useParenthesesForCr ? "(0)" : "0"} value={balances[acc.code]?.cr || ''}
                      onChange={e => handleInputChange(acc.code, 'cr', e.target.value)}
                      className={`w-full p-1.5 text-right bg-slate-50/60 border border-slate-100 rounded-lg focus:outline-none focus:border-amber-500 font-mono font-bold text-xs ${
                        useParenthesesForCr ? 'text-rose-600 border-rose-100 bg-rose-50/20' : 'text-amber-700'
                      }`}
                    />
                  ) : (
                    <div className="text-right text-slate-300 pr-4 font-mono select-none">-</div>
                  )}
                </td>

                {/* Nút hành động */}
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

          {/* ➕ DÒNG INLINE FORM: NHẬP LIỆU THỦ CÔNG LINH HOẠT THEO NHÓM */}
          <tr className="bg-slate-50/40 border-t-2 border-dashed border-slate-200/60">
            <td className="p-2 w-16">
              <input 
                type="text" 
                maxLength={4}
                placeholder={placeholderCode}
                value={inlineInputs[blockId].code}
                onChange={e => handleInlineCodeChange(blockId, e.target.value)}
                className="w-full p-1.5 font-mono font-bold text-slate-700 placeholder-slate-300 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-center text-xs"
              />
            </td>
            <td className="p-2">
              <input 
                type="text" 
                placeholder="Nhập tên tài khoản hoặc tự động định nghĩa..." 
                value={inlineInputs[blockId].name}
                onChange={e => handleInlineNameChange(blockId, e.target.value)}
                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-slate-500 font-medium text-xs"
              />
            </td>
            <td colSpan={2} className="p-2 text-right text-slate-400 font-semibold text-[10px] italic">
              Bấm icon bên cạnh để kích hoạt dòng nhập liệu
            </td>
            <td className="p-2 text-center">
              <button 
                onClick={() => handleAddInlineAccount(blockId)}
                disabled={!inlineInputs[blockId].code}
                className={`transition ${inlineInputs[blockId].code ? 'text-sky-600 hover:text-sky-700' : 'text-slate-300 cursor-not-allowed'}`}
                title="Kích hoạt thêm tài khoản này"
              >
                <PlusCircle size={16} />
              </button>
            </td>
          </tr>

        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto p-4">
      {/* Tiêu đề chính */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-sky-600" size={20} />
            Khai báo Số dư đầu kỳ — Năm {fiscalYear || 2026}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Cải tiến: Thêm tài khoản thủ công trực tiếp tại dòng cuối của từng bảng danh mục</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold border ${
          message.startsWith('🎉') || message.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
        }`}>{message}</div>
      )}

      {/* HAI KHỐI BÁO CÁO CHÍNH */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* TÀI SẢN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-xs uppercase tracking-wider">A. TÀI SẢN</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Mã 1xx & 2xx</span>
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
            {renderSubsectionTable(financialStructure.assetShort, "I. Tài sản ngắn hạn", "text-blue-600", "1", "1xx")}
            {renderSubsectionTable(financialStructure.assetLong, "II. Tài sản dài hạn", "text-indigo-600", "2", "2xx")}
          </div>
        </div>

        {/* NGUỒN VỐN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
            <span className="font-black text-xs uppercase tracking-wider">B. NGUỒN VỐN</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Mã 3xx & 4xx</span>
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
            {renderSubsectionTable(financialStructure.liabilities, "I. Nợ phải trả", "text-amber-600", "3", "3xx")}
            {renderSubsectionTable(financialStructure.equity, "II. Vốn chủ sở hữu", "text-emerald-600", "4", "4xx")}
          </div>
        </div>

      </div>

      {/* ĐỐI CHIẾU CÂN ĐỐI TỔNG LỰC HỆ THỐNG */}
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
          checkBalanceTotals.isBalanced ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">Đối chiếu cân đối hạch toán</span>
            <span className="text-xs font-black flex items-center gap-1 mt-0.5 font-mono">
              {checkBalanceTotals.isBalanced ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {checkBalanceTotals.isBalanced ? 'CÂN ĐỐI HOÀN HẢO' : `LỆCH: ${formatFinancialNumber(Math.abs(checkBalanceTotals.totalDr - checkBalanceTotals.totalCr))}`}
            </span>
          </div>
          <button
            onClick={saveOpeningBalances}
            disabled={loading || !checkBalanceTotals.isBalanced}
            className={`font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-sm ${
              checkBalanceTotals.isBalanced ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save size={14} /> {loading ? 'Đang lưu...' : 'Lưu số dư'}
          </button>
        </div>
      </div>
    </div>
  );
}