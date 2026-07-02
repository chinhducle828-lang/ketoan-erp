import React, { useState, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { BookOpenCheck, RefreshCw, ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function ClosingProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);

  // ==========================================
  // LOGIC XỬ LÝ KHÓA SỔ & KẾT CHUYỂN
  // ==========================================
  const executeClosing = async () => {
    setLoading(true);
    setLog('Đang bóc tách, dọn dẹp số liệu và quét sâu sổ chi tiết...');

    let rev = 0;   
    let cogs = 0;  
    let adminExp = 0; 

    const operationalVouchers = vouchers.filter(v => v.type !== 'Khac');

    operationalVouchers.forEach(v => {
      v.details?.forEach(d => {
        if (d.accountCode?.startsWith('511') && d.entryType === 'CR') {
          rev += Math.round(parseFloat(d.amount) || 0);
        }
        if (d.accountCode?.startsWith('632') && d.entryType === 'DR') {
          cogs += Math.round(parseFloat(d.amount) || 0);
        }
        if (d.accountCode?.startsWith('642') && d.entryType === 'DR') {
          adminExp += Math.round(parseFloat(d.amount) || 0);
        }
      });
    });

    if (rev === 0 && cogs === 0 && adminExp === 0) {
      setLog('⚠️ Không tìm thấy phát sinh doanh thu hoặc chi phí hoạt động mới hợp lệ trong kỳ để kết chuyển.');
      setLoading(false);
      return;
    }

    try {
      if (rev > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển doanh thu thuần xác định kết quả kinh doanh cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '5111', entryType: 'DR', amount: rev },
            { accountCode: '911', entryType: 'CR', amount: rev }
          ]
        });
      }

      if (cogs > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển chi phí giá vốn hàng bán cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '911', entryType: 'DR', amount: cogs },
            { accountCode: '632', entryType: 'CR', amount: cogs }
          ]
        });
      }

      if (adminExp > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển chi phí quản lý doanh nghiệp cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '911', entryType: 'DR', amount: adminExp },
            { accountCode: '642', entryType: 'CR', amount: adminExp }
          ]
        });
      }

      const netProfitOrLoss = rev - (cogs + adminExp);
      
      if (netProfitOrLoss !== 0) {
        const isProfit = netProfitOrLoss > 0;
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: isProfit 
            ? 'Kết chuyển thặng dư lợi nhuận kinh doanh phát sinh trong kỳ (Lãi ròng)' 
            : 'Kết chuyển thâm hụt kết quả kinh doanh phát sinh trong kỳ (Lỗ ròng)',
          type: 'Khac',
          details: isProfit 
            ? [
                { accountCode: '911', entryType: 'DR', amount: netProfitOrLoss },
                { accountCode: '4212', entryType: 'CR', amount: netProfitOrLoss }
              ]
            : [
                { accountCode: '4212', entryType: 'DR', amount: Math.abs(netProfitOrLoss) },
                { accountCode: '911', entryType: 'CR', amount: Math.abs(netProfitOrLoss) }
              ]
        });
      }

      const statusText = netProfitOrLoss >= 0 
        ? `🎉 LÃI RÒNG SAU THUẾ TRONG KỲ: ${netProfitOrLoss.toLocaleString('vi-VN')} đ` 
        : `📉 LỖ RÒNG KINH DOANH TRONG KỲ: ${Math.abs(netProfitOrLoss).toLocaleString('vi-VN')} đ`;

      setLog(`[HỆ THỐNG KẾT CHUYỂN HOÀN THÀNH]\n------------------------------------\n` +
             `✓ Kết chuyển Doanh thu (Nợ 5111 / Có 911): ${rev.toLocaleString('vi-VN')} đ\n` +
             `✓ Kết chuyển Giá vốn  (Nợ 911 / Có 632): ${cogs.toLocaleString('vi-VN')} đ\n` +
             `✓ Kết chuyển CP QLDN  (Nợ 911 / Có 642): ${adminExp.toLocaleString('vi-VN')} đ\n` +
             `------------------------------------\n▶ ${statusText}\n` +
             `👉 Sổ cái tài khoản kết quả (911) đã được làm sạch và đưa về số dư bằng 0.`);

    } catch (error) {
      console.error(error);
      setLog('⚠️ Đã xảy ra lỗi hệ thống khi phát hành chứng từ kết chuyển tự động.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOGIC TỰ ĐỘNG QUÉT SỐ DƯ THEO THÔNG TƯ 99
  // ==========================================
  const financialData = useMemo(() => {
    const getBalance = (accountCode, baseType = 'ASSET') => {
      let bal = 0;
      vouchers.forEach(v => {
        v.details?.forEach(d => {
          if (d.accountCode?.startsWith(accountCode)) {
            const amt = parseFloat(d.amount) || 0;
            if (baseType === 'ASSET') {
              if (accountCode === '214') {
                bal += (d.entryType === 'CR' ? amt : -amt);
              } else {
                bal += (d.entryType === 'DR' ? amt : -amt);
              }
            } else {
              bal += (d.entryType === 'CR' ? amt : -amt);
            }
          }
        });
      });
      return Math.round(bal);
    };

    const tk111 = getBalance('111', 'ASSET');
    const tk112 = getBalance('112', 'ASSET'); 
    const tienVaTuongDuongTien = tk111 + tk112;
    const phaiThuNganHan = getBalance('131', 'ASSET');
    const hangTonKho = getBalance('152', 'ASSET') + getBalance('156', 'ASSET');
    const taiSanNganHan = tienVaTuongDuongTien + phaiThuNganHan + hangTonKho;

    const tk211 = getBalance('211', 'ASSET');
    const tk214 = getBalance('214', 'ASSET'); 
    const tscdHuuHinh = tk211 - tk214;
    
    const tk241 = getBalance('2151', 'ASSET'); 
    const tk242 = getBalance('2152', 'ASSET');
    const taiSanSinhHoc = tk241 + tk242 || getBalance('215', 'ASSET');
    const taiSanDaiHan = tscdHuuHinh + taiSanSinhHoc;

    const tongTaiSan = taiSanNganHan + taiSanDaiHan;

    const tk331 = getBalance('331', 'LIABILITY');
    const tk333 = getBalance('333', 'LIABILITY');
    const tk334 = getBalance('334', 'LIABILITY');
    const noNganHan = tk331 + tk333 + tk334;
    const noPhaiTra = noNganHan;

    const tk411 = getBalance('411', 'EQUITY');
    const tk421 = getBalance('421', 'EQUITY'); 
    const vonChuSoHuu = tk411 + tk421;

    const tongNguonVon = noPhaiTra + vonChuSoHuu;

    return {
      tk111, tk112, tienVaTuongDuongTien, phaiThuNganHan, hangTonKho, taiSanNganHan,
      tk211, tk214, tscdHuuHinh, tk241, tk242, taiSanSinhHoc, taiSanDaiHan, tongTaiSan,
      tk331, tk333, tk334, noNganHan, noPhaiTra, tk411, tk421, vonChuSoHuu, tongNguonVon
    };
  }, [vouchers]);

  return (
    <div className="space-y-6 pb-12">
      {/* Tiêu đề & Cụm Action xuất dữ liệu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <BookOpenCheck className="text-indigo-600" size={24} /> KHÓA SỔ TỰ ĐỘNG & KẾT CHUYỂN KINH DOANH CUỐI KỲ
        </h1>
        
        {/* Nhóm các nút xuất báo cáo */}
        <div className="flex items-center gap-2.5">
          <ExportExcelButton 
            endpoint="financial-report" 
            filename="Bao_Cao_Tinh_Hinh_Tai_Chinh_TT99" 
            label="Xuất BCTC (TT99)" 
            icon={<FileSpreadsheet size={14} className="text-emerald-500" />}
          />
          <ExportExcelButton 
            endpoint="vouchers" 
            filename="So_Nhật_Ký_Chung" 
            label="Xuất nhật ký" 
          />
        </div>
      </div>
      
      {/* Khối tiến trình khóa sổ */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-xl space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Hệ thống quét toàn bộ Sổ cái, tự động gom số dư tài khoản Doanh thu (511), Chi phí (632, 642) kết chuyển tự động sang 911 để xác định Thặng dư/Thâm hụt tài chính của doanh nghiệp pháp nhân.
        </p>
        
        <button 
          onClick={executeClosing} 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
          {loading ? 'Đang hạch toán kết chuyển...' : 'Chạy tiến trình kết chuyển khóa sổ'}
        </button>
        
        {log && (
          <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
            {log}
          </div>
        )}
      </div>

      {/* Bảng báo cáo tình hình tài chính hiển thị trực quan */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Tổng tài sản (Mã số 270)</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{financialData.tongTaiSan.toLocaleString('vi-VN')} VND</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <ArrowUpRight size={18} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Tổng nợ phải trả (Mã số 300)</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{financialData.noPhaiTra.toLocaleString('vi-VN')} VND</p>
            </div>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <ArrowDownRight size={18} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Tổng vốn chủ sở hữu (Mã số 400)</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{financialData.vonChuSoHuu.toLocaleString('vi-VN')} VND</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Scale size={18} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* PHẦN I: TÀI SẢN */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-4 py-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">PHẦN I: TÀI SẢN</h2>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-slate-400 bg-slate-50/50 text-[10px] uppercase font-bold">
                  <th className="py-2 px-4 w-16 text-center">Mã số</th>
                  <th className="py-2 px-2">Chỉ tiêu (Theo Thông tư 99/2025/TT-BTC)</th>
                  <th className="py-2 px-4 text-right w-40">Số cuối năm (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600 font-medium">
                <tr className="bg-slate-50/30 font-bold text-slate-800">
                  <td className="py-2 px-4 text-center">100</td>
                  <td className="py-2 px-2">A. TÀI SẢN NGẮN HẠN</td>
                  <td className="py-2 px-4 text-right">{financialData.taiSanNganHan.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">110</td>
                  <td className="py-2 px-2 pl-4">I. Tiền và các khoản tương đương tiền</td>
                  <td className="py-2 px-4 text-right">{financialData.tienVaTuongDuongTien.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">111</td>
                  <td className="py-1.5 px-2 pl-8">1. Tiền mặt (TK 111)</td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk111.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">112</td>
                  <td className="py-1.5 px-2 pl-8">2. Tiền gửi không kỳ hạn (TK 112) <span className="text-indigo-500 text-[9px] font-bold bg-indigo-50 px-1 py-0.5 rounded ml-1">*TT 99 mới</span></td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk112.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">130</td>
                  <td className="py-2 px-2 pl-4">II. Các khoản phải thu ngắn hạn (TK 131)</td>
                  <td className="py-2 px-4 text-right">{financialData.phaiThuNganHan.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">140</td>
                  <td className="py-2 px-2 pl-4">III. Hàng tồn kho (TK 152, 156)</td>
                  <td className="py-2 px-4 text-right">{financialData.hangTonKho.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="bg-slate-50/30 font-bold text-slate-800">
                  <td className="py-2 px-4 text-center">200</td>
                  <td className="py-2 px-2">B. TÀI SẢN DÀI HẠN</td>
                  <td className="py-2 px-4 text-right">{financialData.taiSanDaiHan.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">220</td>
                  <td className="py-2 px-2 pl-4">I. Tài sản cố định hữu hình</td>
                  <td className="py-2 px-4 text-right">{financialData.tscdHuuHinh.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">221</td>
                  <td className="py-1.5 px-2 pl-8">- Nguyên giá (TK 211)</td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk211.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">222</td>
                  <td className="py-1.5 px-2 pl-8">- Hao mòn lũy kế (TK 214)</td>
                  <td className="py-1.5 px-4 text-right text-rose-600">
                    {financialData.tk214 > 0 ? `(${financialData.tk214.toLocaleString('vi-VN')})` : '0'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">240</td>
                  <td className="py-2 px-2 pl-4">II. Tài sản sinh học dài hạn (TK 215) <span className="text-indigo-500 text-[9px] font-bold bg-indigo-50 px-1 py-0.5 rounded ml-1">*Mới - TT 99</span></td>
                  <td className="py-2 px-4 text-right">{financialData.taiSanSinhHoc.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="bg-indigo-50 text-indigo-900 font-black text-sm">
                  <td className="py-3 px-4 text-center">270</td>
                  <td className="py-3 px-2 uppercase tracking-wide">TỔNG CỘNG TÀI SẢN</td>
                  <td className="py-3 px-4 text-right">{financialData.tongTaiSan.toLocaleString('vi-VN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PHẦN II: NỢ PHẢI TRẢ & VỐN CHỦ SỞ HỮU */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b px-4 py-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">PHẦN II: NỢ PHẢI TRẢ & VỐN CHỦ SỞ HỮU</h2>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-slate-400 bg-slate-50/50 text-[10px] uppercase font-bold">
                  <th className="py-2 px-4 w-16 text-center">Mã số</th>
                  <th className="py-2 px-2">Chỉ tiêu (Theo Thông tư 99/2025/TT-BTC)</th>
                  <th className="py-2 px-4 text-right w-40">Số cuối năm (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600 font-medium">
                <tr className="bg-slate-50/30 font-bold text-slate-800">
                  <td className="py-2 px-4 text-center">300</td>
                  <td className="py-2 px-2">A. NỢ PHẢI TRẢ</td>
                  <td className="py-2 px-4 text-right">{financialData.noPhaiTra.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">310</td>
                  <td className="py-2 px-2 pl-4">I. Nợ ngắn hạn</td>
                  <td className="py-2 px-4 text-right">{financialData.noNganHan.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">311</td>
                  <td className="py-1.5 px-2 pl-8">1. Phải trả người bán ngắn hạn (TK 331)</td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk331.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">312</td>
                  <td className="py-1.5 px-2 pl-8">2. Thuế và các khoản phải nộp nhà nước (TK 333)</td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk333.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="text-slate-500 text-[11px]">
                  <td className="py-1.5 px-4 text-center text-slate-400">313</td>
                  <td className="py-1.5 px-2 pl-8">3. Phải trả người lao động (TK 334)</td>
                  <td className="py-1.5 px-4 text-right">{financialData.tk334.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="bg-slate-50/30 font-bold text-slate-800">
                  <td className="py-2 px-4 text-center">400</td>
                  <td className="py-2 px-2">B. VỐN CHỦ SỞ HỮU</td>
                  <td className="py-2 px-4 text-right">{financialData.vonChuSoHuu.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">410</td>
                  <td className="py-2 px-2 pl-4">I. Vốn góp của chủ sở hữu (TK 411)</td>
                  <td className="py-2 px-4 text-right">{financialData.tk411.toLocaleString('vi-VN')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-center text-slate-400">420</td>
                  <td className="py-2 px-2 pl-4">II. Lợi nhuận sau thuế chưa phân phối (TK 421)</td>
                  <td className="py-2 px-4 text-right">{financialData.tk421.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="bg-indigo-50 text-indigo-900 font-black text-sm">
                  <td className="py-3 px-4 text-center">440</td>
                  <td className="py-3 px-2 uppercase tracking-wide">TỔNG CỘNG NGUỒN VỐN</td>
                  <td className="py-3 px-4 text-right">{financialData.tongNguonVon.toLocaleString('vi-VN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-medium px-1">
          <p>Báo cáo kiểm soát tự động dựa trên Số cái thực tế</p>
          <p className="flex items-center gap-1"><ShieldCheck size={12} className="text-indigo-500" /> Mã bảo mật: TT99-SECURED-2026</p>
        </div>
      </div>
    </div>
  );
}