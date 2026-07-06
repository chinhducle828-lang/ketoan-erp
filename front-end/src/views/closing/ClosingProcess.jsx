import React, { useState, useMemo, useEffect } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { BookOpenCheck, RefreshCw, Scale, CheckCircle, AlertTriangle, Layers, Folder } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

// FIX 3: Account dictionary maintained locally for frontend
// Backend updates via API if needed
const DEFAULT_ACCOUNT_DICTIONARY = {
  '111': 'Tiền mặt tại quỹ',
  '112': 'Tiền gửi Ngân hàng',
  '131': 'Phải thu của khách hàng',
  '138': 'Phải thu khác',
  '141': 'Tạm ứng',
  '152': 'Nguyên liệu, vật liệu tồn kho',
  '153': 'Công cụ, dụng cụ',
  '156': 'Hàng hóa kho tổng',
  '211': 'Tài sản cố định hữu hình',
  '214': 'Hao mòn tài sản cố định',
  '215': 'Tài sản sinh học',
  '229': 'Dự phòng tổn thất tài sản',
  '331': 'Phải trả cho người bán',
  '333': 'Thuế và các khoản phải nộp Nhà nước',
  '334': 'Phải trả người lao động',
  '338': 'Phải trả, phải nộp khác',
  '341': 'Vay và nợ thuê tài chính',
  '411': 'Vốn đầu tư của chủ sở hữu',
  '418': 'Quỹ đầu tư phát triển',
  '421': 'Lợi nhuận sau thuế chưa phân phối',
  '511': 'Doanh thu bán hàng',
  '515': 'Doanh thu hoạt động tài chính',
  '632': 'Giá vốn hàng bán',
  '635': 'Chi phí bán hàng',
  '641': 'Chi phí quản lý doanh nghiệp',
  '642': 'Chi phí sản xuất, kinh doanh',
  '711': 'Thu nhập khác',
  '811': 'Chi phí khác',
  '821': 'Chi phí thuế TNDN'
};

export default function ClosingProcess() {
  const { vouchers, fetchVouchers } = useVouchers();
  const { activeCompany, fiscalYear } = useAuth();
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountLedger, setAccountLedger] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [accountDictionary, setAccountDictionary] = useState(DEFAULT_ACCOUNT_DICTIONARY);
  
  useEffect(() => {
    // FIX 3: Account dictionary loaded from local default (can be extended via API later)
    setAccountDictionary(DEFAULT_ACCOUNT_DICTIONARY);
  }, []);

  const currentCompanyId = activeCompany?.id || activeCompany || vouchers[0]?.companyId || localStorage.getItem('current_company_id') || '';
  
  // Fetch account balances from backend API
  useEffect(() => {
    const loadBalances = async () => {
      if (!currentCompanyId) return;
      
      setLoadingBalances(true);
      try {
        const response = await api.get('/inventory/balances', {
          params: { company_id: currentCompanyId, year: fiscalYear }
        });
        if (response.data?.success && response.data.data?.accountLedger) {
          setAccountLedger(response.data.data.accountLedger);
        }
      } catch (error) {
        console.error('Lỗi tải số dư tài khoản:', error);
      } finally {
        setLoadingBalances(false);
      }
    };

    loadBalances();
  }, [currentCompanyId, fiscalYear]);

  const executeClosing = async () => {
    if (!currentCompanyId) return setLog('⚠️ Hệ thống từ chối: Không xác định được doanh nghiệp hiện tại.');
    setLoading(true);
    setLog('⏳ Đang gửi yêu cầu kích hoạt engine khóa sổ tự động lên máy chủ...');

    try {
      // Sử dụng API endpoint đúng: /api/report/closing
      const response = await fetch('/api/report/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId, year: fiscalYear || 2026 })
      });
      const result = await response.json();

      if (result.success) {
        if (result.empty) {
          setLog(`✓ ${result.message}`);
        } else {
          setLog(`[KẾT CHUYỂN THÀNH CÔNG]\n========================\nLãi/Lỗ ròng phát sinh: ${result.data?.profitOrLoss?.toLocaleString('vi-VN') || 0} đ\nBút toán đã tự động hạch toán dồn số dư từ tài khoản doanh thu/chi phí về 911 và chuyển kết quả vào 421.`);
          if (fetchVouchers) fetchVouchers();
        }
      } else {
        setLog(`❌ Thất bại: ${result.error}`);
      }
    } catch (error) {
      setLog('⚠️ Đã xảy ra lỗi kết nối đường truyền tới máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  // Trích xuất và phân nhóm dữ liệu động kết xuất từ Backend (Engine)
  const financialStructure = useMemo(() => {
    const ledger = accountLedger;
    
    const assetShort = [];
    const assetLong = [];
    const liabilities = [];
    const equity = [];

    let totalAssetShort = 0;
    let totalAssetLong = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Quét toàn bộ danh mục tài khoản từ điển để xử lý số liệu cuối kỳ động
    Object.keys(ACCOUNT_DICTIONARY).forEach(code => {
      const accountData = ledger[code];
      const dr = accountData?.closingDr || 0;
      const cr = accountData?.closingCr || 0;

      // Chỉ giữ lại những tài khoản có phát sinh số dư thực tế (Khác 0)
      if (dr !== 0 || cr !== 0) {
        const payload = {
          code,
          name: ACCOUNT_DICTIONARY[code],
          dr,
          cr
        };

        if (code.startsWith('1')) {
          assetShort.push(payload);
          totalAssetShort += dr;
        } else if (code.startsWith('2')) {
          assetLong.push(payload);
          // Tài khoản hao mòn (214) hoặc dự phòng (229) ghi giảm tài sản
          if (code === '214' || code === '229') {
            totalAssetLong -= cr;
          } else {
            totalAssetLong += dr;
          }
        } else if (code.startsWith('3')) {
          liabilities.push(payload);
          totalLiabilities += cr;
        } else if (code.startsWith('4')) {
          equity.push(payload);
          totalEquity += cr;
        }
      }
    });

    const sortFn = (a, b) => a.code.localeCompare(b.code);
    const tongTaiSan = totalAssetShort + totalAssetLong;
    const tongNguonVon = totalLiabilities + totalEquity;

    return {
      assetShort: assetShort.sort(sortFn),
      assetLong: assetLong.sort(sortFn),
      liabilities: liabilities.sort(sortFn),
      equity: equity.sort(sortFn),
      tongTaiSan,
      tongNguonVon,
      isBalanced: Math.round(tongTaiSan) === Math.round(tongNguonVon)
    };
  }, [accountLedger]);

  // Hàm render bảng con động, tự ẩn dòng khi không có giao dịch
  const renderSubsectionReportTable = (accounts, title, codeColor) => (
    <div className="mb-5 last:mb-0">
      <div className="bg-slate-50/80 px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
        <Folder size={12} className="text-slate-400" />
        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">{title}</span>
      </div>
      <table className="w-full text-left border-collapse text-xs">
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-slate-400 italic text-[11px]">
                Không phát sinh giao dịch biến động ở nhóm này trong chu kỳ hạch toán
              </td>
            </tr>
          ) : (
            accounts.map(acc => {
              const isAssetNegative = acc.code === '214' || acc.code === '229';
              return (
                <tr key={acc.code} className="hover:bg-slate-50/30 transition animate-fadeIn">
                  <td className={`p-3 w-16 font-mono font-bold ${codeColor}`}>{acc.code}</td>
                  <td className="p-3 text-slate-500 font-semibold truncate max-w-[150px] md:max-w-none">{acc.name}</td>
                  
                  {/* Cột số dư Nợ */}
                  <td className="p-3 w-32 text-right font-mono font-bold text-blue-700">
                    {acc.dr > 0 ? acc.dr.toLocaleString('vi-VN') : '—'}
                  </td>

                  {/* Cột số dư Có */}
                  <td className={`p-3 w-32 text-right font-mono font-bold ${isAssetNegative ? 'text-rose-600' : 'text-amber-700'}`}>
                    {acc.cr > 0 ? (isAssetNegative ? `(${acc.cr.toLocaleString('vi-VN')})` : acc.cr.toLocaleString('vi-VN')) : '—'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto p-4 font-sans text-slate-800 antialiased">
      
      {/* 1. Thanh tiêu đề đầu trang */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-indigo-600" size={20} />
            Bảng Khóa Sổ & Cân Đối Kế Toán Nội Bộ (TT99)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Dữ liệu được xử lý real-time tự động dựa trên các chứng từ kết chuyển đầu cuối từ Backend</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton />
          <button
            onClick={executeClosing}
            disabled={loading || loadingBalances}
            className="font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-sm disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : <BookOpenCheck size={14} />}
            Thực hiện khóa sổ
          </button>
        </div>
      </div>

      {/* 2. Console hiển thị Log tiến trình của máy chủ */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 mb-2 text-slate-400 font-bold text-[11px] uppercase tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Nhật ký xử lý hệ toán cuối kỳ
        </div>
        <pre className="w-full h-24 bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-xl overflow-y-auto border border-slate-800/60 leading-relaxed whitespace-pre-line">
          {log || (loadingBalances ? "Đang tải số dư tài khoản từ máy chủ..." : "Hệ thống sẵn sàng. Bấm nút 'Thực hiện khóa sổ' để máy chủ bắt đầu tổng hợp dữ liệu kết chuyển doanh thu, chi phí...")}
        </pre>
      </div>

      {/* 3. Phân hệ bảng biểu báo cáo động dạng 2 khối TÀI SẢN - NGUỒN VỐN */}
      {loadingBalances ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-3" size={32} />
          <p className="text-sm text-slate-500 font-semibold">Đang tính toán số dư tài khoản từ máy chủ...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* KHỐI A: TÀI SẢN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
              <span className="font-black text-xs uppercase tracking-wider">A. TÀI SẢN</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Tổng số dư cuối kỳ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border-b border-slate-100">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                    <th className="p-3 w-16">Mã TK</th>
                    <th className="p-3">Tên tài khoản kế toán phát sinh</th>
                    <th className="p-3 w-32 text-right">Số dư Nợ (DR)</th>
                    <th className="p-3 w-32 text-right">Số dư Có (CR)</th>
                  </tr>
                </thead>
              </table>
              {renderSubsectionReportTable(financialStructure.assetShort, "I. Tài sản ngắn hạn", "text-blue-600")}
              {renderSubsectionReportTable(financialStructure.assetLong, "II. Tài sản dài hạn", "text-indigo-600")}
            </div>
          </div>

          {/* KHỐI B: NGUỒN VỐN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
              <span className="font-black text-xs uppercase tracking-wider">B. NGUỒN VỐN</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded">Tổng số dư cuối kỳ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border-b border-slate-100">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                    <th className="p-3 w-16">Mã TK</th>
                    <th className="p-3">Tên tài khoản kế toán phát sinh</th>
                    <th className="p-3 w-32 text-right">Số dư Nợ (DR)</th>
                    <th className="p-3 w-32 text-right">Số dư Có (CR)</th>
                  </tr>
                </thead>
              </table>
              {renderSubsectionReportTable(financialStructure.liabilities, "I. Nợ phải trả", "text-amber-600")}
              {renderSubsectionReportTable(financialStructure.equity, "II. Vốn chủ sở hữu", "text-emerald-600")}
            </div>
          </div>

        </div>
      )}

      {/* 4. Khối đối chiếu cân đối tổng lực chân trang */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng tài sản trị giá</span>
          <h3 className="text-base font-black text-blue-700 mt-0.5">
            {financialStructure.tongTaiSan.toLocaleString('vi-VN')} đ
          </h3>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng nguồn vốn trị giá</span>
          <h3 className="text-base font-black text-amber-700 mt-0.5">
            {financialStructure.tongNguonVon.toLocaleString('vi-VN')} đ
          </h3>
        </div>
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          financialStructure.isBalanced ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">Cân đối kế toán kép</span>
            <span className="text-xs font-black flex items-center gap-1 mt-0.5 font-mono">
              {financialStructure.isBalanced ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {financialStructure.isBalanced 
                ? 'HỆ THỐNG CÂN ĐỐI KHỚP SỔ' 
                : `LỆCH SỔ SÁCH: ${Math.abs(financialStructure.tongTaiSan - financialStructure.tongNguonVon).toLocaleString('vi-VN')} đ`
              }
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}