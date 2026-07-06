import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Layers, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx'; 
import { getDefaultCurrency } from '../../utils/accountingRules.js';

export default function AutoSalesExcel() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const [excelData, setExcelData] = useState([]); 
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const validData = data.map((r, i) => ({
          id: r.ID || r.id || `INV-${i+1}`,
          customer: r.Customer || r.customer || 'Khách lẻ',
          amount: parseFloat(r.Amount || r.amount) || 0,
          taxRate: parseFloat(r.TaxRate || r.taxRate) || 10
        })).filter(r => r.amount > 0);
        
        setExcelData(validData);
      } catch (err) { alert('Lỗi đọc file Excel!'); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSync = async () => {
    const companyId = activeCompany?.id ?? activeCompany;
    if (!companyId) return alert('Vui lòng chọn công ty!');
    setLoading(true);

    try {
      // Map từng hóa đơn thành 1 payload gửi API
      for (const inv of excelData) {
        const baseAmount = Math.round(inv.amount);
        const taxAmount = Math.round(baseAmount * (inv.taxRate / 100));
        
        const details = [
          { accountCode: '131', entryType: 'DR', amount: baseAmount + taxAmount },
          { accountCode: '511', entryType: 'CR', amount: baseAmount }
        ];
        if (taxAmount > 0) details.push({ accountCode: '3331', entryType: 'CR', amount: taxAmount });

        const payload = {
          companyId: parseInt(companyId, 10),
          voucherDate: new Date().toISOString().split('T')[0],
          type: 'PK', // Dùng phiếu khác cho doanh thu
          description: `Doanh thu bán hàng Excel: ${inv.id} - ${inv.customer}`,
          currency: getDefaultCurrency(),
          exchangeRate: 1,
          details: details
        };
        
        await createNewVoucher(payload);
      }
      alert('Đồng bộ dữ liệu bán hàng từ Excel thành công!');
      setExcelData([]);
    } catch (err) {
      alert('Có lỗi xảy ra trong quá trình đồng bộ (Kiểm tra khóa sổ)!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
        <Layers className="text-blue-600" size={24} /> ĐỒNG BỘ DOANH THU TỪ EXCEL
      </h1>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        
        {excelData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
              <span className="text-xs font-bold text-slate-600">Đã đọc: {excelData.length} hóa đơn hợp lệ</span>
              <button onClick={handleSync} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Thực thi ghi sổ đồng loạt'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}