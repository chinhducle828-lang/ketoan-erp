import React, { useState } from 'react';
// ✅ ĐÃ SỬA: Import trực tiếp hàm từ file api tổng để đính kèm RAM Token tự động
import { createInventoryVoucher } from '../../utils/api.js';

export default function InventoryVoucherForm() {
  // ✅ ĐÃ SỬA: Tự động lấy thông tin phiên làm việc từ localStorage để tránh điền ID thủ công
  const getActiveCompanyId = () => {
    try {
      const company = localStorage.getItem('activeCompany');
      return company ? JSON.parse(company).id : 1;
    } catch (e) {
      return 1;
    }
  };

  const getActiveUserId = () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id : 1;
    } catch (e) {
      return 1;
    }
  };

  // 1. State quản lý thông tin chung (Master)
  const [master, setMaster] = useState({
    company_id: getActiveCompanyId(), 
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    io_type: 'IMPORT', // Mặc định là IMPORT (Nhập kho mua hàng)
    partner_id: '',
    description: '',
    created_by: getActiveUserId()
  });

  // 2. State quản lý lưới danh sách vật tư đa dòng (Detail)
  const [details, setDetails] = useState([
    { item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0 }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Xử lý thay đổi thông tin chung
  const handleMasterChange = (e) => {
    setMaster({ ...master, [e.target.name]: e.target.value });
  };

  // Xử lý thay đổi dữ liệu trên từng dòng vật tư
  const handleDetailChange = (index, e) => {
    const updatedDetails = [...details];
    updatedDetails[index][e.target.name] = e.target.value;
    setDetails(updatedDetails);
  };

  // Thêm một dòng trống vào lưới hạch toán
  const addDetailRow = () => {
    setDetails([...details, { item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0 }]);
  };

  // Xóa một dòng bất kỳ
  const removeDetailRow = (index) => {
    if (details.length > 1) {
      setDetails(details.filter((_, i) => i !== index));
    }
  };

  // Bấm nút Lưu phiếu
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Định dạng chính xác kiểu dữ liệu số trước khi đẩy lên API
      const formattedDetails = details.map(d => ({
        item_id: parseInt(d.item_id, 10),
        debit_account_code: d.debit_account_code.trim(),
        credit_account_code: d.credit_account_code.trim(),
        quantity: parseFloat(d.quantity),
        unit_price: parseFloat(d.unit_price)
      }));

      const payload = { 
        ...master, 
        company_id: getActiveCompanyId(), // Đảm bảo luôn lấy ID mới nhất của phiên làm việc
        created_by: getActiveUserId(),
        partner_id: parseInt(master.partner_id, 10),
        details: formattedDetails 
      };

      const result = await createInventoryVoucher(payload);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Khởi tạo lại form trống sau khi lưu thành công
        setDetails([{ item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0 }]);
        setMaster({ ...master, voucher_number: '', description: '', partner_id: '' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Có lỗi xảy ra khi lưu phiếu kho!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-slate-900 text-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-3 text-emerald-400">
        Lập Phiếu Nhập Kho Vật Tư / Hàng Hóa
      </h2>

      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-emerald-800/80 border border-emerald-500' : 'bg-rose-800/80 border border-rose-500'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* THÔNG TIN CHUNG (MASTER) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800 p-4 rounded border border-slate-700">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-400">Số chứng từ</label>
            <input required type="text" name="voucher_number" value={master.voucher_number} onChange={handleMasterChange} className="w-full bg-slate-700 p-2 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 text-white" placeholder="VD: PN001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-400">Ngày hạch toán</label>
            <input required type="date" name="voucher_date" value={master.voucher_date} onChange={handleMasterChange} className="w-full bg-slate-700 p-2 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-400">Mã đối tác (ID)</label>
            <input required type="number" name="partner_id" value={master.partner_id} onChange={handleMasterChange} className="w-full bg-slate-700 p-2 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 text-white" placeholder="ID nhà cung cấp" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-400">Diễn giải</label>
            <input type="text" name="description" value={master.description} onChange={handleMasterChange} className="w-full bg-slate-700 p-2 rounded border border-slate-600 focus:outline-none focus:border-emerald-500 text-white" placeholder="Lý do nhập kho..." />
          </div>
        </div>

        {/* LƯỚI CHI TIẾT (DETAIL) */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-300">Chi tiết định khoản hàng hóa</h3>
          <div className="overflow-x-auto rounded border border-slate-700">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-700">
                  <th className="p-3">Mã VT (ID)</th>
                  <th className="p-3">TK Nợ</th>
                  <th className="p-3">TK Có</th>
                  <th className="p-3 text-right">Số lượng</th>
                  <th className="p-3 text-right">Đơn giá</th>
                  <th className="p-3 text-right">Thành tiền</th>
                  <th className="p-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-850">
                {details.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-2">
                      <input required type="number" name="item_id" value={row.item_id} onChange={(e) => handleDetailChange(index, e)} className="w-24 bg-slate-700 p-1.5 rounded text-white border border-slate-600 focus:outline-none focus:border-emerald-500" placeholder="ID VT" />
                    </td>
                    <td className="p-2">
                      <input required type="text" name="debit_account_code" value={row.debit_account_code} onChange={(e) => handleDetailChange(index, e)} className="w-20 bg-slate-700 p-1.5 rounded text-white text-center border border-slate-600 focus:outline-none focus:border-emerald-500" />
                    </td>
                    <td className="p-2">
                      <input required type="text" name="credit_account_code" value={row.credit_account_code} onChange={(e) => handleDetailChange(index, e)} className="w-20 bg-slate-700 p-1.5 rounded text-white text-center border border-slate-600 focus:outline-none focus:border-emerald-500" />
                    </td>
                    <td className="p-2">
                      <input required type="number" name="quantity" min="0.0001" step="any" value={row.quantity} onChange={(e) => handleDetailChange(index, e)} className="w-24 bg-slate-700 p-1.5 rounded text-white text-right border border-slate-600 focus:outline-none focus:border-emerald-500" />
                    </td>
                    <td className="p-2">
                      <input required type="number" name="unit_price" min="0" step="any" value={row.unit_price} onChange={(e) => handleDetailChange(index, e)} className="w-28 bg-slate-700 p-1.5 rounded text-white text-right border border-slate-600 focus:outline-none focus:border-emerald-500" />
                    </td>
                    <td className="p-2 text-right font-medium text-amber-400 select-none">
                      {((row.quantity || 0) * (row.unit_price || 0)).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeDetailRow(index)} className="text-rose-400 hover:text-rose-500 font-bold px-2 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addDetailRow} className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded border border-slate-600 transition-colors text-slate-300">
            + Thêm dòng vật tư
          </button>
        </div>

        {/* NÚT HOÀN TẤT */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button type="submit" disabled={loading} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold rounded shadow-md transition-colors">
            {loading ? 'Đang lưu phiếu...' : 'Lưu chứng từ'}
          </button>
        </div>
      </form>
    </div>
  );
}