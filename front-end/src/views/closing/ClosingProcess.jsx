import React, { useState, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { calculateBalances } from '../../utils/accountingEngine'; // Import File 1 vào đây
import { BookOpenCheck, RefreshCw, ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function ClosingProcess() {
  const { vouchers, fetchVouchers } = useVouchers();
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);

  const currentCompanyId = vouchers[0]?.companyId || ''; 

  const executeClosing = async () => {
    if (!currentCompanyId) return setLog('⚠️ Không xác định được Doanh nghiệp.');
    setLoading(true);
    setLog('⏳ Đang gửi yêu cầu khóa sổ an toàn lên máy chủ...');

    try {
      const response = await fetch('/api/vouchers/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: currentCompanyId, year: 2026 })
      });
      const result = await response.json();

      if (result.success) {
        if (result.empty) setLog(`✓ ${result.message}`);
        else {
          setLog(`[KẾT CHUYỂN THÀNH CÔNG] Lãi/Lỗ ròng: ${result.data.profitOrLoss.toLocaleString()} đ`);
          if (fetchVouchers) fetchVouchers();
        }
      } else setLog(`❌ Thất bại: ${result.error}`);
    } catch (error) {
      setLog('⚠️ Đã xảy ra lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  // Áp dụng Engine kế toán để lấy số liệu chuẩn
  const financialData = useMemo(() => {
    const ledger = calculateBalances(vouchers); // Chạy qua File 1

    const getBal = (code, type = 'DR') => ledger[code] ? ledger[code][`closing${type}`] : 0;

    const tk111 = getBal('111', 'Dr');
    const tk112 = getBal('112', 'Dr');
    const phaiThuNganHan = getBal('131', 'Dr');
    const hangTonKho = getBal('152', 'Dr') + getBal('156', 'Dr');
    const taiSanNganHan = tk111 + tk112 + phaiThuNganHan + hangTonKho;

    const tk211 = getBal('211', 'Dr');
    const tk214 = getBal('214', 'Cr'); // 214 dư Có
    const tscdHuuHinh = tk211 - tk214;
    const taiSanSinhHoc = getBal('215', 'Dr');
    const taiSanDaiHan = tscdHuuHinh + taiSanSinhHoc;

    const tongTaiSan = taiSanNganHan + taiSanDaiHan;

    const tk331 = getBal('331', 'Cr');
    const tk333 = getBal('333', 'Cr');
    const tk334 = getBal('334', 'Cr');
    const noPhaiTra = tk331 + tk333 + tk334;

    const tk411 = getBal('411', 'Cr');
    const tk421 = getBal('421', 'Cr');
    const vonChuSoHuu = tk411 + tk421;
    
    const tongNguonVon = noPhaiTra + vonChuSoHuu;

    return { 
      tk111, tk112, phaiThuNganHan, hangTonKho, taiSanNganHan, 
      tk211, tk214, taiSanSinhHoc, taiSanDaiHan, tongTaiSan, 
      tk331, tk333, tk334, noPhaiTra, tk411, tk421, vonChuSoHuu, tongNguonVon 
    };
  }, [vouchers]);

  return (
    <div className="space-y-6 pb-12">
      {/* (Giữ nguyên toàn bộ phần giao diện hiển thị JSX HTML của file ClosingProcess cũ) */}
      <div className="flex justify-between">
         <h1 className="text-xl font-black text-slate-800">KHÓA SỔ & BÁO CÁO (TT99)</h1>
         <button onClick={executeClosing} className="bg-indigo-600 text-white px-4 py-2 rounded">Khóa sổ</button>
      </div>
      <div className="p-4 bg-slate-900 text-emerald-400">{log}</div>
      <div className="grid grid-cols-2 gap-6">
        <div>TỔNG TÀI SẢN: {financialData.tongTaiSan.toLocaleString()} đ</div>
        <div>TỔNG NGUỒN VỐN: {financialData.tongNguonVon.toLocaleString()} đ</div>
      </div>
    </div>
  );
}