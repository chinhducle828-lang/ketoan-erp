
/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { useVoucherQueries } from '../../hooks/useVoucherQueries.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Layers, Loader2, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx'; 
import api from '../../utils/api.js';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import TransactionClassifier from '../../components/TransactionClassifier.jsx';
import { classifyTransaction } from '../../services/transactionClassification.js';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl.js';

/**
 * Mẫu Excel 2 chiều cho đồng bộ doanh thu bán hàng.
 * Các cột hỗ trợ:
 *   ID, Customer, Amount, TaxRate, Discount, Coupon, ShippingFee,
 *   PaymentMethod, SalesChannel, PaymentStatus
 */
const TEMPLATE_COLUMNS = [
  'ID',
  'Customer',
  'Amount',
  'TaxRate',
  'Discount',
  'Coupon',
  'ShippingFee',
  'PaymentMethod',
  'SalesChannel',
  'PaymentStatus'
];

export default function AutoSalesExcel() {
  const { createVoucher } = useVoucherQueries();
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
          taxRate: parseFloat(r.TaxRate || r.taxRate) || 8,
          discount: parseFloat(r.Discount || r.discount) || 0,
          coupon: r.Coupon || r.coupon || '',
          shippingFee: parseFloat(r.ShippingFee || r.shippingFee) || 0,
          paymentMethod: r.PaymentMethod || r.paymentMethod || 'cod',
          salesChannel: r.SalesChannel || r.salesChannel || 'import_excel',
          paymentStatus: r.PaymentStatus || r.paymentStatus || 'pending'
        })).filter(r => r.amount > 0);
        
        setExcelData(validData);
      } catch (err) { alert('Lỗi đọc file Excel!'); }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [TEMPLATE_COLUMNS];
    // Sample row
    wsData.push(['INV-001', 'Nguyễn Văn A', 1000000, 8, 50000, 'SAVE10', 30000, 'cod', 'import_excel', 'pending']);
    wsData.push(['INV-002', 'Trần Thị B', 2500000, 10, 0, '', 50000, 'bank_transfer', 'retail', 'pending']);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'ke-toan-doanh-thu-template.xlsx');
  };

  const handleExport = async () => {
    const companyId = activeCompany?.id ?? activeCompany;
    if (!companyId) return alert('Vui lòng chọn công ty!');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${resolveApiBaseUrl()}/export/sales-revenue?company_id=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Lỗi xuất Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Doanh_Thu_Ban_Hang_${companyId}_${new Date().getFullYear()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Lỗi xuất Excel');
    }
  };

  // Get default account codes for sales revenue (fallback)
  const getDefaultSalesAccounts = () => {
    return {
      revenueAccount: '511',  // Doanh thu bán hàng
      arAccount: '131',       // Phải thu của khách hàng
      taxAccount: '3331'      // Thuế GTGT
    };
  };

  const handleSync = async () => {
    const companyId = activeCompany?.id ?? activeCompany;
    if (!companyId) return alert('Vui lòng chọn công ty!');
    setLoading(true);

    try {
      // Map từng hóa đơn thành 1 payload gửi API
      for (const inv of excelData) {
        const baseAmount = Math.round(inv.amount);
        const discountAmount = Math.round(inv.discount);
        const taxRate = inv.taxRate;
        const taxAmount = Math.round((baseAmount - discountAmount) * (taxRate / 100));
        const netRevenue = baseAmount - discountAmount + Math.round(inv.shippingFee);
        
        // Try to get AI classification for this transaction
        let accountCodes = getDefaultSalesAccounts();
        try {
          const classification = await classifyTransaction({
            description: `Doanh thu bán hàng: ${inv.customer}`,
            amount: baseAmount,
            partner_id: null
          });
          
          if (classification?.success && classification?.classification?.account_code) {
            // Use AI suggested account if available
            accountCodes = {
              ...accountCodes,
              revenueAccount: classification.classification.account_code,
              arAccount: classification.classification.account_code
            };
          }
        } catch (e) {
          // Use default accounts on error
          console.log('Using default accounts for sales transaction');
        }
        
        // Hạch toán đúng: Nợ 131 (Phải thu KH) / Có 511 (Doanh thu) + Có 3331 (Thuế GTGT)
        const details = [
          { accountCode: accountCodes.arAccount, entryType: 'DR', amount: netRevenue + taxAmount },
          { accountCode: accountCodes.revenueAccount, entryType: 'CR', amount: netRevenue }
        ];
        if (taxAmount > 0) details.push({ accountCode: accountCodes.taxAccount, entryType: 'CR', amount: taxAmount });

        const payload = {
          companyId: parseInt(companyId, 10),
          voucherDate: new Date().toISOString().split('T')[0],
          type: 'PKT', // Phiếu kế toán tổng hợp cho doanh thu
          description: `Doanh thu bán hàng Excel: ${inv.id} - ${inv.customer}`,
          currency: getDefaultCurrency(),
          exchangeRate: 1,
          discount_amount: discountAmount,
          coupon_code: inv.coupon || null,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          shipping_fee: Math.round(inv.shippingFee),
          payment_method: inv.paymentMethod,
          payment_status: inv.paymentStatus,
          sales_channel: inv.salesChannel,
          details: details
        };
        
        await createVoucher(payload);
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
        <div className="flex items-center gap-3">
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <button onClick={downloadTemplate} className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Download size={14} /> Template
          </button>
          <button onClick={handleExport} className="flex-shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5">
            <Upload size={14} /> Export doanh thu
          </button>
        </div>
        
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs font-bold text-blue-800 mb-1">Cấu trúc file Excel mẫu 2 chiều:</p>
          <p className="text-[10px] text-blue-700 font-mono">
            {TEMPLATE_COLUMNS.join(' | ')}
          </p>
          <p className="text-[10px] text-blue-600 mt-1">
            2 dòng mẫu đã được tải về khi nhấn "Template". Ghi đè dữ liệu của bạn lên đó.
          </p>
        </div>
        
        {excelData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border">
              <span className="text-xs font-bold text-slate-600">Đã đọc: {excelData.length} hóa đơn hợp lệ</span>
              <button onClick={handleSync} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Thực thi ghi sổ đồng loạt'}
              </button>
            </div>
            
            {/* Preview table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold">
                    <th className="px-2 py-1.5 text-left">ID</th>
                    <th className="px-2 py-1.5 text-left">Khách hàng</th>
                    <th className="px-2 py-1.5 text-right">Số tiền</th>
                    <th className="px-2 py-1.5 text-right">Thuế %</th>
                    <th className="px-2 py-1.5 text-right">Giảm giá</th>
                    <th className="px-2 py-1.5 text-left">Coupon</th>
                    <th className="px-2 py-1.5 text-right">Phí ship</th>
                    <th className="px-2 py-1.5 text-left">TT. toán</th>
                    <th className="px-2 py-1.5 text-left">Kênh</th>
                  </tr>
                </thead>
                <tbody>
                  {excelData.slice(0, 20).map((inv, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-semibold">{inv.id}</td>
                      <td className="px-2 py-1.5">{inv.customer}</td>
                      <td className="px-2 py-1.5 text-right">{inv.amount.toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-1.5 text-right">{inv.taxRate}%</td>
                      <td className="px-2 py-1.5 text-right">{inv.discount.toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-1.5">{inv.coupon || '-'}</td>
                      <td className="px-2 py-1.5 text-right">{inv.shippingFee.toLocaleString('vi-VN')}</td>
                      <td className="px-2 py-1.5">{inv.paymentMethod}</td>
                      <td className="px-2 py-1.5">{inv.salesChannel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelData.length > 20 && (
                <p className="px-2 py-1 text-[10px] text-slate-400 border-t border-slate-100">
                  ... và {excelData.length - 20} hóa đơn khác
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}