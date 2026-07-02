import React, { useState, useEffect } from 'react';
// ✅ Import trực tiếp hàm từ file api tổng để đính kèm RAM Token tự động
import { createInventoryVoucher } from '../../utils/api.js';

export default function InventoryVoucherForm() {
  // Tự động lấy thông tin phiên làm việc từ localStorage để tránh điền ID thủ công
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

  // 1. State quản lý thông tin chung (Hiển thị Form)
  const [master, setMaster] = useState({
    company_id: getActiveCompanyId(), 
    voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    io_type: 'IMPORT', // IMPORT (Nhập kho) / EXPORT (Xuất kho)
    partner_id: '',
    description: '',
    created_by: getActiveUserId()
  });

  // 2. State quản lý lưới danh sách vật tư đa dòng (Hàng ngang)
  const [details, setDetails] = useState([
    { item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0 }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);

  // ✅ Tự động tính tổng tiền của phiếu để hiển thị trên UI
  useEffect(() => {
    const total = details.reduce((sum, d) => sum + (parseFloat(d.quantity || 0) * parseFloat(d.unit_price || 0)), 0);
    setTotalAmount(total);
  }, [details]);

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

  // ✅ ĐÃ SỬA TOÀN BỘ LOGIC: Chuyển đổi dữ liệu ngang sang dọc chuẩn kế toán kép trước khi gọi API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const mappedDetails = [];
      
      // Duyệt qua từng dòng vật tư hàng ngang của UI để bóc tách thành các cặp dòng DR/CR dọc
      details.forEach((d) => {
        const lineAmount = parseFloat(d.quantity || 0) * parseFloat(d.unit_price || 0);
        
        // 1. Tạo dòng ghi Nợ (DR) chuẩn Backend
        mappedDetails.push({
          accountCode: d.debit_account_code.trim(),
          entryType: 'DR',
          amount: lineAmount
        });
        
        // 2. Tạo dòng ghi Có (CR) chuẩn Backend
        mappedDetails.push({
          accountCode: d.credit_account_code.trim(),
          entryType: 'CR',
          amount: lineAmount
        });
      });

      // Tạo cấu trúc Payload khớp hoàn chỉnh với Zod Validation tại Backend
      const payload = { 
        voucherDate: master.voucher_date,
        description: master.description || `Nhập kho vật tư theo số chứng từ ${master.voucher_number}`,
        type: master.io_type === 'IMPORT' ? 'Thu' : 'Chi', 
        companyId: Number(getActiveCompanyId()), 
        details: mappedDetails 
      };

      // Gọi API thực tế gửi lên Backend
      const result = await createInventoryVoucher(payload);

      if (result.success) {
        setMessage({ type: 'success', text: 'Tạo phiếu và ghi sổ kế toán thành công!' });
        // Reset form về trạng thái trống ban đầu
        setDetails([{ item_id: '', debit_account_code: '152', credit_account_code: '331', quantity: 1, unit_price: 0 }]);
        setMaster({ ...master, voucher_number: '', description: '', partner_id: '' });
      }
    } catch (err) {
      // Đọc thông báo lỗi trả về từ Backend (Zod hoặc Database error)
      const errorResponse = err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Có lỗi xảy ra khi lưu phiếu kho!';
      setMessage({ type: 'error', text: errorResponse });
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ GIAO DIỆN MÀU TRẮNG SÁNG: Phù hợp với Cấu hình hệ thống của bạn
    <div className="p-6 max-w-6xl mx-auto bg-white text-slate-800 rounded-lg shadow-md border border-slate-100">
      <h2 className="text-2xl font-semibold mb-6 border-b border-slate-200 pb-3 text-slate-900 flex items-center">
        <span className="w-2 h-6 bg-emerald-500 rounded-full mr-3"></span>
        Lập Phiếu Nhập Kho Vật Tư / Hàng Hóa
      </h2>

      {message && (
        <div className={`p-4 mb-5 rounded border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span className="font-semibold">{message.type === 'success' ? '✓ Thành công:' : '⚠ Lỗi:'}</span> {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* THÔNG TIN CHUNG (MASTER) - Sử dụng tông màu xám nhẹ của giao diện bạn */}
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Thông tin chung chứng từ PN</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600">Số chứng từ</label>
              <input required type="text" name="voucher_number" value={master.voucher_number} onChange={handleMasterChange} className="w-full bg-white p-2 rounded border border-slate-200 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 text-slate-800" placeholder="VD: PN26-0001" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600">Ngày hạch toán</label>
              <input required type="date" name="voucher_date" value={master.voucher_date} onChange={handleMasterChange} className="w-full bg-white p-2 rounded border border-slate-200 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 text-slate-800" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600">Mã đối tác (ID)</label>
              <input required type="number" name="partner_id" value={master.partner_id} onChange={handleMasterChange} className="w-full bg-white p-2 rounded border border-slate-200 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 text-slate-800" placeholder="Nhập ID" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600">Diễn giải</label>
              <input type="text" name="description" value={master.description} onChange={handleMasterChange} className="w-full bg-white p-2 rounded border border-slate-200 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 text-slate-800" placeholder="Lý do nhập kho..." />
            </div>
          </div>
        </div>

        {/* LƯỚI CHI TIẾT (DETAIL) - Sử dụng bảng trắng với viền xám nhẹ */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-slate-800">Chi tiết vật tư & hạch toán</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider border-b border-slate-200">
                  <th className="p-3 font-semibold">Mã VT (ID)</th>
                  <th className="p-3 font-semibold text-center w-28">TK Nợ</th>
                  <th className="p-3 font-semibold text-center w-28">TK Có</th>
                  <th className="p-3 text-right font-semibold w-28">Số lượng</th>
                  <th className="p-3 text-right font-semibold w-32">Đơn giá</th>
                  <th className="p-3 text-right font-semibold w-40">Thành tiền</th>
                  <th className="p-3 text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {details.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2">
                      <input required type="number" name="item_id" value={row.item_id} onChange={(e) => handleDetailChange(index, e)} className="w-full bg-white p-1.5 rounded text-slate-800 border border-slate-200 focus:outline-none focus:border-emerald-300" placeholder="Nhập ID" />
                    </td>
                    <td className="p-2">
                      <input required type="text" name="debit_account_code" value={row.debit_account_code} onChange={(e) => handleDetailChange(index, e)} className="w-full bg-white p-1.5 rounded text-slate-800 text-center border border-slate-200 focus:outline-none focus:border-emerald-300 font-medium" />
                    </td>
                    <td className="p-2">
                      <input required type="text" name="credit_account_code" value={row.credit_account_code} onChange={(e) => handleDetailChange(index, e)} className="w-full bg-white p-1.5 rounded text-slate-800 text-center border border-slate-200 focus:outline-none focus:border-emerald-300 font-medium" />
                    </td>
                    <td className="p-2">
                      <input required type="number" name="quantity" min="0.0001" step="any" value={row.quantity} onChange={(e) => handleDetailChange(index, e)} className="w-full bg-white p-1.5 rounded text-slate-800 text-right border border-slate-200 focus:outline-none focus:border-emerald-300" />
                    </td>
                    <td className="p-2">
                      <input required type="number" name="unit_price" min="0" step="any" value={row.unit_price} onChange={(e) => handleDetailChange(index, e)} className="w-full bg-white p-1.5 rounded text-slate-800 text-right border border-slate-200 focus:outline-none focus:border-emerald-300" />
                    </td>
                    <td className="p-2 text-right font-semibold text-emerald-600 select-none">
                      {((row.quantity || 0) * (row.unit_price || 0)).toLocaleString('vi-VN')}
                    </td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => removeDetailRow(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors" title="Xóa dòng này">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ✅ Hiển thị tổng tiền ở cuối bảng */}
              <tfoot>
                <tr className="bg-slate-50/50 font-semibold border-t border-slate-200">
                  <td colSpan="5" className="p-3 text-right text-slate-600 uppercase text-xs tracking-wider">Tổng giá trị phiếu nhập kho:</td>
                  <td className="p-3 text-right text-lg text-emerald-700">{totalAmount.toLocaleString('vi-VN')} VND</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ✅ Nút thêm dòng sử dụng màu xám nhẹ của giao diện bạn */}
          <button type="button" onClick={addDetailRow} className="mt-3 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded font-medium border border-slate-200 transition-colors">
            + Thêm dòng vật tư hạch toán
          </button>
        </div>

        {/* NÚT HOÀN TẤT - Sử dụng màu xanh lục (Emerald) làm điểm nhấn */}
        <div className="flex justify-end pt-5 border-t border-slate-100">
          <button type="submit" disabled={loading} className="px-10 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-md shadow-sm transition-colors text-base">
            {loading ? 'Đang gửi dữ liệu...' : 'Lưu & Ghi Sổ Kế Toán'}
          </button>
        </div>
      </form>
    </div>
  );
}