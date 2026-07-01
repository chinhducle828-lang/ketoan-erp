import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { Layers, FileSpreadsheet, Play, Loader2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import * as XLSX from 'xlsx'; // Import thư viện đọc file Excel thật

export default function AutoSalesExcel() {
  const { createNewVoucher } = useVouchers();
  const [excelData, setExcelData] = useState([]); // Lưu dữ liệu thật sau khi parse từ file Excel
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Hàm xử lý khi người dùng chọn/upload file Excel thật
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMsg('Đang đọc tệp Excel...');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Lấy dữ liệu từ Sheet đầu tiên của file Excel
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Chuyển đổi dữ liệu trong sheet thành mảng JSON
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          setMsg('⚠️ Tệp Excel trống hoặc không đúng định dạng!');
          return;
        }

        // Chuẩn hóa key dữ liệu (vừa hỗ trợ chữ hoa vừa hỗ trợ chữ thường từ file Excel)
        const formattedData = data.map((row, index) => ({
          id: row.id || row.Id || row.MA_HD || row.InvoiceNo || `HD-${index + 1}`,
          customer: row.customer || row.Customer || row.TEN_KH || 'Khách hàng vãng lai',
          amount: parseFloat(row.amount || row.Amount || row.TIEN_HANG) || 0,
          taxRate: parseFloat(row.taxRate || row.TaxRate || row.THUE_SUAT) ?? 10 // Mặc định 10% nếu file không có cột thuế
        }));

        setExcelData(formattedData);
        setMsg(`✅ Đã đọc thành công ${formattedData.length} dòng dữ liệu từ file Excel! Hãy kiểm tra lại bên dưới trước khi đồng bộ.`);
      } catch (err) {
        console.error(err);
        setMsg('⚠️ Lỗi định dạng! Không thể đọc file Excel này.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Hàm đẩy toàn bộ dữ liệu đã đọc lên Backend theo cấu trúc chuẩn Master-Detail
  const handleSyncAll = async () => {
    if (excelData.length === 0) return;
    setLoading(true);
    setMsg('Hệ thống đang tiến hành hạch toán đồng bộ dữ liệu...');

    try {
      for (const row of excelData) {
        if (row.amount <= 0) continue; // Bỏ qua các dòng không có tiền hàng

        const baseAmount = row.amount;
        const taxAmount = Math.round(baseAmount * (row.taxRate / 100));
        const totalAmount = baseAmount + taxAmount;

        // Xây dựng cấu trúc định khoản đa dòng (Master-Detail) cho nghiệp vụ bán hàng
        const details = [
          {
            accountCode: '131', // Ghi Nợ 131 - Phải thu khách hàng (Tổng giá thanh toán)
            entryType: 'DR',
            amount: totalAmount
          },
          {
            accountCode: '5111', // Ghi Có 5111 - Doanh thu bán hàng hóa
            entryType: 'CR',
            amount: baseAmount
          }
        ];

        // Nếu phát sinh thuế GTGT đầu ra thì đẩy thêm dòng Có 33311 vào mảng chi tiết
        if (taxAmount > 0) {
          details.push({
            accountCode: '33311', // Ghi Có 33311 - Thuế GTGT đầu ra phải nộp
            entryType: 'CR',
            amount: taxAmount
          });
        }

        // Gửi API tạo chứng từ duy nhất chứa mảng details
        await createNewVoucher({
          voucherDate: '2026-04-01', // Có thể thay bằng row.date nếu file Excel của bạn có cột ngày
          description: `Doanh thu bán hàng tự động từ Excel - Hóa đơn số ${row.id} (${row.customer})`,
          type: 'Thu',
          details: details
        });
      }

      setMsg(`✅ Đồng bộ thành công toàn bộ ${excelData.length} hóa đơn từ Excel vào hệ thống kế toán đám mây!`);
      setExcelData([]);
    } catch (error) {
      console.error(error);
      setMsg('⚠️ Lỗi kết nối, tiến trình tự động hạch toán bị gián đoạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Layers className="text-emerald-600" size={24} /> ĐỒNG BỘ DOANH THU HOÁ ĐƠN HÀNG LOẠT TỪ EXCEL
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="Doanh_Thu_Ban_Hang" label="Xuất Excel" />
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs font-bold ${msg.startsWith('⚠️') ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {msg}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
        {/* Vùng chọn file Excel thật từ máy tính */}
        <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-6 bg-slate-50 text-center relative transition">
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            disabled={loading}
          />
          <FileSpreadsheet className="text-emerald-600 mx-auto mb-2" size={32} />
          <span className="text-xs font-bold text-slate-600 block">Kéo thả hoặc Click để chọn file Excel thật từ máy tính</span>
          <span className="text-[10px] text-slate-400 font-medium block mt-1">Hệ thống chấp nhận các file định dạng chuẩn .xlsx hoặc .xls</span>
        </div>

        {/* Hiển thị bảng dữ liệu thực tế đọc được và nút đồng bộ */}
        {excelData.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Xem trước dữ liệu hóa đơn trong file</span>
              <button 
                onClick={handleSyncAll} 
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1 shadow-sm transition"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} 
                {loading ? 'Đang hạch toán...' : `Đồng bộ ghi sổ ${excelData.length} hàng`}
              </button>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden text-xs divide-y max-h-96 overflow-y-auto">
              {excelData.map((r, idx) => {
                const tax = Math.round(r.amount * (r.taxRate / 100));
                const total = r.amount + tax;
                return (
                  <div key={idx} className="p-3 flex justify-between bg-white hover:bg-slate-50/50 transition items-center">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-blue-600">{r.id}</span>
                      <span className="text-slate-700 font-medium ml-2">{r.customer}</span>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-800">{total.toLocaleString()} đ</div>
                      <div className="text-[10px] text-slate-400">Gốc: {r.amount.toLocaleString()} đ | Thuế ({r.taxRate}%): {tax.toLocaleString()} đ</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}