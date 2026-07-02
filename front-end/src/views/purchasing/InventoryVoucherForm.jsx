import React, { useState, useEffect } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function InventoryVoucherForm() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth(); // Theo dõi công ty đang làm việc từ Context lõi

  const getActiveUserId = () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id : 1;
    } catch (e) {
      return 1;
    }
  };

  const [master, setMaster] = useState({
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    io_type: 'IMPORT', 
    partner_id: '',
    description: '',
    created_by: getActiveUserId()
  });

  const [details, setDetails] = useState([
    { item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0, tax_rate: 10 }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    let total = 0;
    details.forEach(row => {
      const qty = parseFloat(row.quantity) || 0;
      const price = parseFloat(row.unit_price) || 0;
      const tax = parseFloat(row.tax_rate) || 0;
      const subTotal = qty * price;
      total += subTotal + (subTotal * (tax / 100));
    });
    setTotalAmount(Math.round(total));
  }, [details]);

  const handleMasterChange = (field, value) => {
    setMaster({ ...master, [field]: value });
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...details];
    newDetails[index][field] = value;
    setDetails(newDetails);
  };

  const addDetailRow = () => {
    setDetails([...details, { item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0, tax_rate: 10 }]);
  };

  const removeDetailRow = (index) => {
    if (details.length === 1) return;
    setDetails(details.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // -----------------------------------------------------------------
      // BIÊN DỊCH DỮ LIỆU VẬT TƯ THÀNH ĐỊNH KHOẢN ĐA DÒNG ĐỂ NUÔI ENGINE LÕI
      // -----------------------------------------------------------------
      const accountingDetails = [];

      details.forEach(row => {
        const qty = parseFloat(row.quantity) || 0;
        const price = parseFloat(row.unit_price) || 0;
        const taxRate = parseFloat(row.tax_rate) || 0;
        
        const baseAmount = Math.round(qty * price);
        const taxAmount = Math.round(baseAmount * (taxRate / 100));

        // Dòng 1: Ghi Nợ tài khoản kho (152, 156,...) - Giá trị gốc vật tư trước thuế
        accountingDetails.push({
          accountCode: row.debit_account_code,
          entryType: 'DR',
          amount: baseAmount,
          item_id: row.item_id 
        });

        // Dòng 2: Ghi Nợ tài khoản Thuế GTGT đầu vào (1331) nếu có thuế phát sinh
        if (taxAmount > 0) {
          accountingDetails.push({
            accountCode: '1331',
            entryType: 'DR',
            amount: taxAmount
          });
        }

        // Dòng 3: Ghi Có tài khoản đối ứng công nợ/tiền mặt (331, 1111,...) - Tổng giá thanh toán
        accountingDetails.push({
          accountCode: row.credit_account_code,
          entryType: 'CR',
          amount: baseAmount + taxAmount
        });
      });

      const payload = {
        ...master,
        company_id: activeCompany?.id || activeCompany || 1,
        type: master.io_type === 'IMPORT' ? 'NK' : 'XK',
        description: master.description || `Hạch toán tự động từ phiếu kho hàng hóa`,
        inventory_items: details, // Giữ lại cấu trúc phẳng phục vụ báo cáo Thẻ kho chi tiết độc lập
        details: accountingDetails // Đẩy trực tiếp mảng định khoản chuẩn vào Sổ Cái lõi
      };

      await createNewVoucher(payload);
      setMessage({ type: 'success', text: 'Đã lập phiếu kho và ghi sổ hạch toán đồng bộ thành công!' });
      
      // Reset trạng thái form về ban đầu
      setDetails([{ item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0, tax_rate: 10 }]);
      setMaster({ ...master, voucher_number: '', description: '' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Lỗi đồng bộ dữ liệu chứng từ kho.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Lập phiếu kho & hạch toán tự động</h2>
        <p className="text-xs text-slate-400">Hệ thống tự động đồng bộ mảng chi tiết vật tư thành định khoản kép nuôi Sổ Cái.</p>
      </div>

      {message && (
        <div className={`p-3 text-xs font-semibold rounded-xl ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.text}
        </div>
      )}

      {/* THÔNG TIN CHUNG (MASTER) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="font-bold text-slate-500 block mb-1">Số chứng từ kho</label>
          <input type="text" required value={master.voucher_number} onChange={e => handleMasterChange('voucher_number', e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:border-emerald-500" placeholder="PN001..." />
        </div>
        <div>
          <label className="font-bold text-slate-500 block mb-1">Ngày chứng từ</label>
          <input type="date" required value={master.voucher_date} onChange={e => handleMasterChange('voucher_date', e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:outline-none" />
        </div>
        <div>
          <label className="font-bold text-slate-500 block mb-1">Tính chất chứng từ</label>
          <select value={master.io_type} onChange={e => handleMasterChange('io_type', e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl font-semibold text-slate-700 focus:outline-none">
            <option value="IMPORT">NHẬP KHO VẬT TƯ</option>
            <option value="EXPORT">XUẤT KHO VẬT TƯ</option>
          </select>
        </div>
      </div>

      <div className="text-xs">
        <label className="font-bold text-slate-500 block mb-1">Diễn giải nội dung</label>
        <input type="text" value={master.description} onChange={e => handleMasterChange('description', e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl focus:outline-none" placeholder="Nhập mục đích nhập xuất vật tư chi tiết..." />
      </div>

      {/* LƯỚI DANH MỤC VẬT TƯ ĐA DÒNG */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="p-3">Mã vật tư</th>
                <th className="p-3">TK Nợ</th>
                <th className="p-3">TK Có</th>
                <th className="p-3 w-16 text-center">SL</th>
                <th className="p-3">Đơn giá (đ)</th>
                <th className="p-3 w-16 text-center">Thuế (%)</th>
                <th className="p-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/40 transition">
                  <td className="p-2"><input type="text" required placeholder="VT_CODE" value={row.item_id} onChange={e => handleDetailChange(idx, 'item_id', e.target.value)} className="w-full p-1.5 border rounded-lg focus:outline-none font-mono" /></td>
                  <td className="p-2"><input type="text" required placeholder="152" value={row.debit_account_code} onChange={e => handleDetailChange(idx, 'debit_account_code', e.target.value.toUpperCase())} className="w-full p-1.5 border rounded-lg focus:outline-none font-mono" /></td>
                  <td className="p-2"><input type="text" required placeholder="331" value={row.credit_account_code} onChange={e => handleDetailChange(idx, 'credit_account_code', e.target.value.toUpperCase())} className="w-full p-1.5 border rounded-lg focus:outline-none font-mono" /></td>
                  <td className="p-2 text-center"><input type="number" required value={row.quantity} onChange={e => handleDetailChange(idx, 'quantity', e.target.value)} className="w-full p-1.5 border rounded-lg focus:outline-none text-center" /></td>
                  <td className="p-2"><input type="number" required value={row.unit_price} onChange={e => handleDetailChange(idx, 'unit_price', e.target.value)} className="w-full p-1.5 border rounded-lg focus:outline-none" /></td>
                  <td className="p-2 text-center"><input type="number" required value={row.tax_rate} onChange={e => handleDetailChange(idx, 'tax_rate', e.target.value)} className="w-full p-1.5 border rounded-lg focus:outline-none text-center" /></td>
                  <td className="p-2 text-center">
                    <button type="button" onClick={() => removeDetailRow(idx)} className="text-slate-400 hover:text-rose-600 transition-colors text-xs font-bold">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/50 font-semibold border-t border-slate-200">
                <td colSpan="5" className="p-3 text-right text-slate-600 uppercase text-[10px] tracking-wider">Tổng thanh toán sau thuế VAT:</td>
                <td className="p-3 text-right text-sm text-emerald-700 font-black" colSpan="2">{totalAmount.toLocaleString('vi-VN')} VND</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <button type="button" onClick={addDetailRow} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-bold border border-slate-200 transition-colors">
        + Thêm dòng vật tư hạch toán
      </button>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-sm transition-all">
          {loading ? 'Đang xử lý hạch toán...' : 'Ghi sổ Phiếu kho Hệ thống'}
        </button>
      </div>
    </form>
  );
}