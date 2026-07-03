// FILE_PATH: front-end/src/views/inventory/InventoryVoucherForm.jsx
import React, { useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function InventoryVoucherForm({ onSaved }) {
  const { activeCompany } = useAuth();
  const [voucher, setVoucher] = useState({
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    voucher_type: 'PN',
    description: '',
    details: [
      { account_code: '1561', entry_type: 'DR', amount: 0, item_id: '', quantity: 0, price: 0 },
      { account_code: '331', entry_type: 'CR', amount: 0, partner_id: '' }
    ]
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeCompany) return alert('Vui lòng lựa chọn doanh nghiệp hạch toán!');
    
    setLoading(true);
    try {
      const payload = { ...voucher, company_id: activeCompany.id };
      await api.post('/vouchers', payload);
      alert('Hạch toán chứng từ kho thành công!');
      if (onSaved) onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi kiểm định cân đối hạch toán kép.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-6 bg-white rounded-xl shadow-md space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700">Số Chứng Từ</label>
          <input type="text" required value={voucher.voucher_number}
            onChange={e => setVoucher({...voucher, voucher_number: e.target.value})}
            className="w-full text-xs p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Ngày Hạch Toán</label>
          <input type="date" required value={voucher.voucher_date}
            onChange={e => setVoucher({...voucher, voucher_date: e.target.value})}
            className="w-full text-xs p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">Loại Chứng Từ</label>
          <select value={voucher.voucher_type}
            onChange={e => setVoucher({...voucher, voucher_type: e.target.value})}
            className="w-full text-xs p-2 border rounded-md">
            <option value="PN">PN - Nhập kho vật tư</option>
            <option value="PX">PX - Xuất kho hàng hóa</option>
          </select>
        </div>
      </div>
      
      <button type="submit" disabled={loading}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-lg disabled:opacity-50">
        {loading ? 'Đang kiểm tra & ghi sổ cái...' : 'Ghi sổ kế toán (Post Voucher)'}
      </button>
    </form>
  );
}