import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { Layers, FileSpreadsheet } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function AutoSalesExcel() {
  const { createNewVoucher } = useVouchers();
  const [simulatedRows, setSimulatedRows] = useState([]);

  const handleSyncAll = async () => {
    for (const row of simulatedRows) {
      await createNewVoucher({
        voucherDate: '2026-04-01',
        description: `Doanh thu bán hàng hóa tự động từ Excel cho ${row.customer}`,
        accountDr: '131', accountCr: '5111', amount: row.amount, type: 'Xuan'
      });
    }
    alert('Đã xử lý đồng bộ chuỗi hóa đơn Excel và tự động sinh sổ cái hạch toán Nợ 131 / Có 5111 thành công!');
    setSimulatedRows([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Layers className="text-emerald-600" size={24} /> ĐỒNG BỘ DOANH THU HOÁ ĐƠN HÀNG LOẠT TỪ EXCEL</h1>
        <ExportExcelButton endpoint="vouchers" filename="Doanh_Thu_Ban_Hang" label="Xuất Excel" />
      </div>
      <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
        <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-slate-50">
          <FileSpreadsheet className="text-emerald-600 mb-2" size={32} />
          <span className="text-xs font-semibold text-slate-600">Hệ thống sẵn sàng phân tách luồng dữ liệu Excel bán ra</span>
        </div>
        {simulatedRows.length > 0 && (
          <div className="space-y-2">
            <button onClick={handleSyncAll} className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl">Đồng bộ ghi sổ toàn bộ dữ liệu Excel ({simulatedRows.length} hàng)</button>
            <div className="border rounded-xl overflow-hidden text-xs">
              {simulatedRows.map(r => (
                <div key={r.id} className="p-2 border-b flex justify-between bg-white">
                  <span>{r.id} - <b>{r.customer}</b></span>
                  <span className="font-mono font-bold text-slate-700">{r.amount.toLocaleString()} đ</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}