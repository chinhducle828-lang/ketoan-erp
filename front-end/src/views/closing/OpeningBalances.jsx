import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Save, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Users } from 'lucide-react';
import api from '../../utils/api.js';

// Danh mục tài khoản chuẩn hóa theo đúng tên hiển thị và tính chất trong ảnh
const ACCOUNT_DICTIONARY = {
  '111': { name: 'Tiền mặt', type: 'DR' },
  '112': { name: 'Tiền gửi Ngân hàng', type: 'DR' },
  '131': { name: 'Phải thu của khách hàng (Lưỡng tính)', type: 'BOTH' },
  '152': { name: 'Nguyên liệu, vật liệu', type: 'DR' },
  '156': { name: 'Hàng hóa', type: 'DR' },
  '211': { name: 'Tài sản cố định hữu hình', type: 'DR' },
  '214': { name: 'Hao mòn tài sản cố định (Ghi âm)', type: 'CR_NEG' },
  '215': { name: 'Tài sản sinh học', type: 'DR' },
  '331': { name: 'Phải trả cho người bán (Lưỡng tính)', type: 'BOTH' },
  '333': { name: 'Thuế và các khoản phải nộp Nhà nước', type: 'CR' },
  '334': { name: 'Phải trả người lao động (Lưỡng tính)', type: 'BOTH' },
  '411': { name: 'Vốn đầu tư của chủ sở hữu', type: 'CR' },
  '421': { name: 'Lợi nhuận sau thuế chưa phân phối', type: 'CR' },
};

// Tài khoản lưỡng tính cần chọn đối tác
const HERMAPHRODITIC_ACCOUNTS = ['131', '331'];

const PAGE_STRUCTURE = [
  {
    key: 'assets',
    title: 'A. TÀI SẢN',
    badge: 'Mã 1xx & 2xx',
    subSections: [
      { id: '1xx', title: 'I. TÀI SẢN NGẮN HẠN', codes: ['111', '112', '131', '152', '156'], prefix: '1' },
      { id: '2xx', title: 'II. TÀI SẢN DÀI HẠN', codes: ['211', '214', '215'], prefix: '2' }
    ]
  },
  {
    key: 'capital',
    title: 'B. NGUỒN VỐN',
    badge: 'Mã 3xx & 4xx',
    subSections: [
      { id: '3xx', title: 'I. NỢ PHẢI TRẢ', codes: ['331', '333', '334'], prefix: '3' },
      { id: '4xx', title: 'II. VỐN CHỦ SỞ HỮU', codes: ['411', '421'], prefix: '4' }
    ]
  }
];

export default function OpeningBalances() {
  const { vouchers } = useVouchers();
  const { activeCompany, fiscalYear } = useAuth();
  
  const [balances, setBalances] = useState([]);
  const [customAccounts, setCustomAccounts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // Quản lý trạng thái nhập liệu dòng động (Inline Input)
  const [activeGroupId, setActiveGroupId] = useState(null); 
  const [inlineCode, setInlineCode] = useState('');
  const [inlineName, setInlineName] = useState('');
  const [selectedPartner, setSelectedPartner] = useState({}); // Lưu partner_id theo account_code
  const inlineCodeRef = useRef(null);

  // Tự động tải lại số dư khi người dùng đổi công ty hoặc đổi năm trên Header
  useEffect(() => {
    if (activeCompany?.id) {
      fetchAndInitializeBalances();
      fetchPartners();
    } else {
      initEmptyBalances();
      setPartners([]);
    }
  }, [activeCompany?.id, fiscalYear]);

  // Lấy danh sách đối tác
  const fetchPartners = async () => {
    try {
      const res = await api.get(`/partners?company_id=${activeCompany.id}`);
      const partnerList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
      setPartners(partnerList);
    } catch (error) {
      console.error('Lỗi tải danh sách đối tác:', error);
      setPartners([]);
    }
  };

  const allBalances = useMemo(() => {
    const sorted = Object.entries(ACCOUNT_DICTIONARY).map(([code, config]) => {
      const found = balances.find(b => b.account_code === code);
      return found || { account_code: code, account_name: config.name, debit_balance: 0, credit_balance: 0 };
    });
    return [...sorted, ...customAccounts];
  }, [balances, customAccounts]);

  const fetchAndInitializeBalances = async () => {
    try {
      setLoading(true);
      const currentYear = fiscalYear || 2026;
      const res = await api.get('/opening-balances', { params: { year: currentYear } });

      if (res.data && res.data.length > 0) {
        const dbMap = new Map(res.data.map(item => [item.account_code || item.accountCode, item]));
        const merged = Object.entries(ACCOUNT_DICTIONARY).map(([code, config]) => {
          const dbItem = dbMap.get(code);
          return {
            account_code: code,
            account_name: config.name,
            debit_balance: Number(dbItem?.opening_debit || dbItem?.debit_balance || dbItem?.debitBalance || 0),
            credit_balance: Number(dbItem?.opening_credit || dbItem?.credit_balance || dbItem?.creditBalance || 0),
          };
        });

        const customs = [];
        // Khôi phục partner_id từ server cho tài khoản lưỡng tính
        const restoredPartners = {};
        
        res.data.forEach(item => {
          const code = item.account_code || item.accountCode;
          const partnerId = item.partner_id || item.partnerId || null;
          
          // Lưu partner_id cho tài khoản lưỡng tính
          if (HERMAPHRODITIC_ACCOUNTS.includes(code) && partnerId) {
            restoredPartners[code] = partnerId;
          }
          
          if (!ACCOUNT_DICTIONARY[code]) {
            let groupId = '1xx';
            if (code.startsWith('2')) groupId = '2xx';
            if (code.startsWith('3')) groupId = '3xx';
            if (code.startsWith('4')) groupId = '4xx';

            customs.push({
              account_code: code,
              account_name: item.account_name || `TK ${code}`,
              debit_balance: Number(item.opening_debit || item.debit_balance || item.debitBalance || 0),
              credit_balance: Number(item.opening_credit || item.credit_balance || item.creditBalance || 0),
              groupId,
              isCustom: true,
            });
          }
        });

        // Khôi phục partner_id đã lưu
        setSelectedPartner(prev => ({ ...prev, ...restoredPartners }));
        
        setBalances(merged);
        setCustomAccounts(customs);
      } else {
        initEmptyBalances();
      }
    } catch (error) {
      console.error(error);
      initEmptyBalances();
    } finally {
      setLoading(false);
    }
  };

  const initEmptyBalances = () => {
    setBalances(Object.entries(ACCOUNT_DICTIONARY).map(([code, config]) => ({
      account_code: code,
      account_name: config.name,
      debit_balance: 0,
      credit_balance: 0,
    })));
    setCustomAccounts([]);
  };

  const updateBalanceValue = (code, field, value) => {
    const numVal = Number(value) || 0;
    if (ACCOUNT_DICTIONARY[code]) {
      setBalances(prev => prev.map(b => (b.account_code === code ? { ...b, [field]: numVal } : b)));
    } else {
      setCustomAccounts(prev => prev.map(b => (b.account_code === code ? { ...b, [field]: numVal } : b)));
    }
  };

  const handleActivateInlineInput = (sub) => {
    setActiveGroupId(sub.id);
    setInlineCode(sub.prefix); 
    setInlineName('');
    setTimeout(() => inlineCodeRef.current?.focus(), 50);
  };

  const handleSaveInlineAccount = (sub) => {
    const codeTrimmed = inlineCode.trim();
    const nameTrimmed = inlineName.trim();

    if (!codeTrimmed || codeTrimmed === sub.prefix) return;
    if (!nameTrimmed) return;
    if (!codeTrimmed.startsWith(sub.prefix)) return;
    if (allBalances.some(b => b.account_code === codeTrimmed)) return;

    setCustomAccounts(prev => [...prev, {
      account_code: codeTrimmed,
      account_name: nameTrimmed,
      debit_balance: 0,
      credit_balance: 0,
      groupId: sub.id,
      isCustom: true
    }]);

    setActiveGroupId(null);
    setInlineCode('');
    setInlineName('');
  };

  const removeCustomAccount = (code) => {
    setCustomAccounts(prev => prev.filter(b => b.account_code !== code));
  };

  const totals = useMemo(() => {
    const totalDr = allBalances.reduce((s, b) => s + Number(b.debit_balance || 0), 0);
    const totalCr = allBalances.reduce((s, b) => s + Number(b.credit_balance || 0), 0);
    return {
      totalDr,
      totalCr,
      isBalanced: totalDr === totalCr && totalDr >= 0,
    };
  }, [allBalances]);

  const saveOpeningBalances = async () => {
    if (!activeCompany?.id) {
      setMessage('Vui lòng chọn doanh nghiệp trước khi lưu.');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const items = allBalances.filter(b => b.account_code && b.account_code.trim() !== '');
      await Promise.all(items.map(item => {
        const partnerId = HERMAPHRODITIC_ACCOUNTS.includes(item.account_code) 
          ? selectedPartner[item.account_code] || null 
          : null;
        return api.post('/opening-balances', {
          companyId: activeCompany.id,
          accountCode: item.account_code,
          debitBalance: item.debit_balance || 0,
          creditBalance: item.credit_balance || 0,
          fiscalYear: fiscalYear || 2026,
          partnerId: partnerId,
        });
      }));
      setMessage('Lưu dữ liệu số dư đầu kỳ thành công!');
      setMessageType('success');
    } catch (error) {
      setMessage('Gặp lỗi khi lưu thông tin.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 p-1 font-sans text-sm antialiased text-slate-800 space-y-4">
      
      {/* 1. TIÊU ĐỀ TRANG TINH GỌN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Số Dư Đầu Kỳ Tài Khoản
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Thiết lập số dư cho doanh nghiệp: <span className="text-emerald-700 font-bold">{activeCompany?.name || 'Chưa chọn'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-500' : ''} />
          {activeCompany?.id ? `Đang kết nối cơ sở dữ liệu năm ${fiscalYear}` : 'Vui lòng chọn doanh nghiệp ở thanh Header'}
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-medium shadow-sm transition-all tracking-wide ${
          messageType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {messageType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message}
        </div>
      )}

      {/* 2. BẢNG SỐ DƯ 2 CỘT TÀI SẢN & NGUỒN VỐN */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {PAGE_STRUCTURE.map((block) => (
          <div key={block.key} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="bg-[#1e293b] px-4 py-3 flex justify-between items-center text-white">
              <h2 className="font-bold text-sm tracking-wide">{block.title}</h2>
              <span className="text-[10px] bg-slate-700 text-slate-300 font-semibold px-2 py-0.5 rounded-md">
                {block.badge}
              </span>
            </div>

            <div className="p-4 space-y-6">
              {block.subSections.map((sub) => {
                const standardItems = allBalances.filter(b => sub.codes.includes(b.account_code));
                const customItems = customAccounts.filter(b => b.groupId === sub.id);
                const mergedItems = [...standardItems, ...customItems];

                // Tính toán cấu trúc cột động cho phân mục hiện tại để tránh vỡ Table
                const hasPartnerColumn = HERMAPHRODITIC_ACCOUNTS.some(c => sub.codes.includes(c));
                const hasActionColumn = customAccounts.some(b => b.groupId === sub.id);
                const totalCols = 4 + (hasPartnerColumn ? 1 : 0) + (hasActionColumn ? 1 : 0);

                return (
                  <div key={sub.id} className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="w-1.5 h-3 bg-indigo-500 rounded-sm inline-block"></span>
                      {sub.title}
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-2 pl-1 w-[75px]">Mã TK</th>
                            <th className="py-2">Tên tài khoản kế toán</th>
                            {hasPartnerColumn && (
                              <th className="py-2 w-[140px]">Đối tác</th>
                            )}
                            <th className="py-2 text-center w-[120px]">Số dư Nợ (DR)</th>
                            <th className="py-2 text-center w-[120px]">Số dư Có (CR)</th>
                            {hasActionColumn && <th className="py-2 w-[35px]"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {mergedItems.map((item) => {
                            const config = ACCOUNT_DICTIONARY[item.account_code] || { type: 'BOTH' };
                            const isDrDisabled = config.type === 'CR';
                            const isCrDisabled = config.type === 'DR';
                            const isHermaphroditic = HERMAPHRODITIC_ACCOUNTS.includes(item.account_code);

                            return (
                              <tr key={item.account_code} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="py-2 font-semibold text-blue-600 font-mono">{item.account_code}</td>
                                <td className="py-2 text-slate-600 font-medium pr-2">{item.account_name}</td>
                                
                                {hasPartnerColumn && (
                                  <td className="py-1 px-1">
                                    {isHermaphroditic ? (
                                      <select
                                        value={selectedPartner[item.account_code] ?? ''}
                                        onChange={(e) => {
                                          const partnerId = e.target.value ? Number(e.target.value) : null;
                                          setSelectedPartner(prev => ({
                                            ...prev,
                                            [item.account_code]: partnerId
                                          }));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-400"
                                      >
                                        <option value="">-- Chọn đối tác --</option>
                                        {(Array.isArray(partners) ? partners : []).map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.partner_name} ({p.partner_code})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div className="text-center text-slate-300">-</div>
                                    )}
                                  </td>
                                )}

                                <td className="py-1 px-1">
                                  {isDrDisabled ? (
                                    <div className="text-center text-slate-300 font-medium">-</div>
                                  ) : (
                                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono text-xs text-slate-700 focus:outline-none focus:border-blue-400 focus:bg-white" placeholder="0"
                                      value={item.debit_balance || ''} onChange={(e) => updateBalanceValue(item.account_code, 'debit_balance', e.target.value)} />
                                  )}
                                </td>
                                
                                <td className="py-1 px-1">
                                  {isCrDisabled ? (
                                    <div className="text-center text-slate-300 font-medium">-</div>
                                  ) : (
                                    <input 
                                      type="number" 
                                      className={`w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono text-xs focus:outline-none focus:border-amber-400 focus:bg-white ${config.type === 'CR_NEG' ? 'text-rose-600 font-bold' : 'text-slate-700'}`} 
                                      placeholder="0"
                                      value={item.credit_balance || ''} 
                                      onChange={(e) => updateBalanceValue(item.account_code, 'credit_balance', e.target.value)} 
                                    />
                                  )}
                                </td>

                                {hasActionColumn && (
                                  <td className="py-1 text-center">
                                    {item.isCustom ? (
                                      <button onClick={() => removeCustomAccount(item.account_code)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                        <Trash2 size={13} />
                                      </button>
                                    ) : null}
                                  </td>
                                )}
                              </tr>
                            );
                          })}

                          {/* DÒNG NHẬP LIỆU ĐỘNG THÊM TÀI KHOẢN MỚI */}
                          {activeGroupId === sub.id ? (
                            <tr className="bg-slate-50/50 border-2 border-dashed border-indigo-200 rounded">
                              <td className="py-1.5 px-1">
                                <input
                                  ref={inlineCodeRef}
                                  type="text"
                                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-indigo-500"
                                  value={inlineCode}
                                  onChange={(e) => setInlineCode(e.target.value)}
                                  placeholder={sub.id}
                                />
                              </td>
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
                                  value={inlineName}
                                  onChange={(e) => setInlineName(e.target.value)}
                                  placeholder="Nhập tên tài khoản..."
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveInlineAccount(sub)}
                                />
                              </td>
                              <td colSpan={totalCols - 3} className="py-1.5 pr-2 text-right text-[11px] text-slate-400 italic">
                                Nhấn Enter hoặc nút (+) để thêm
                              </td>
                              <td className="py-1.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveInlineAccount(sub);
                                  }}
                                  className="w-5 h-5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow"
                                >
                                  <Plus size={12} className="stroke-[3px]" />
                                </button>
                              </td>
                            </tr>
                          ) : (
                            <tr 
                              onClick={() => handleActivateInlineInput(sub)}
                              className="bg-transparent text-slate-400/80 cursor-pointer hover:bg-slate-50 transition-colors group"
                            >
                              <td className="py-2.5 font-mono text-slate-400 italic group-hover:text-slate-600 pl-1">{sub.id}</td>
                              <td className="py-2.5 text-[11px] text-slate-400 italic group-hover:text-slate-600">
                                Nhập tên tài khoản hoặc tự động định nghĩa
                              </td>
                              <td colSpan={totalCols - 3} className="py-2.5 text-right text-[11px] text-slate-400/60 italic pr-3">
                                Bấm icon bên cạnh để kích hoạt dòng nhập liệu
                              </td>
                              <td className="py-2.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivateInlineInput(sub);
                                  }}
                                  className="w-5 h-5 rounded-md border border-slate-200 bg-white hover:border-indigo-400 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all shadow-sm"
                                >
                                  <Plus size={12} className="stroke-[3px]" />
                                </button>
                              </td>
                            </tr>
                          )}

                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 3. FOOTER ĐỐI CHIẾU CÂN ĐỐI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 flex flex-col justify-center shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số dư Nợ (Tổng DR)</span>
          <div className="text-xl font-black text-blue-600 mt-1">
            {totals.totalDr.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">đ</span>
          </div>
        </div>
        <div className="bg-[#f8fafc] border border-slate-200 rounded-xl p-4 flex flex-col justify-center shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số dư Có (Tổng CR)</span>
          <div className="text-xl font-black text-amber-600 mt-1">
            {totals.totalCr.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">đ</span>
          </div>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex flex-col pl-1">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Đối chiếu cân đối hạch toán</span>
            <div className="flex items-center gap-1.5 mt-1 text-emerald-700 font-black text-xs tracking-wide">
              <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white font-serif text-[10px]">✓</span>
              {totals.isBalanced ? 'CÂN ĐỐI HOÀN HẢO' : 'MẤT CÂN ĐỐI'}
            </div>
          </div>
          <button onClick={saveOpeningBalances} disabled={loading}
            className="bg-[#1e6091] hover:bg-[#1a4f76] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu số dư
          </button>
        </div>
      </div>

    </div>
  );
}