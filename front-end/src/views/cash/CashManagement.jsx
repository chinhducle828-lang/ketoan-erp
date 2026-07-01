import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Wallet, Plus, Trash2, ListPlus } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function CashManagement() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  
  // Khởi tạo form theo cấu trúc Master-Detail mới
  const [form, setForm] = usePersistentState('cash-management-form-v2', {
    date: '2026-01-01',
    desc: '',
    details: [
      { accountCode: '1111', entryType: 'DR', amount: '' },
      { accountCode: '131', entryType: 'CR', amount: '' }
    ]
  });

  // Lọc chứng từ dựa trên thuộc tính "type" (đã được đổi tên từ voucher_type)
  const cashVouchers = vouchers.filter(v => v.type === 'Thu' || v.type === 'Chi');

  // Hàm xử lý thay đổi giá trị của từng dòng hạch toán chi tiết
  const handleDetailChange = (index, field, value) => {
    const newDetails = [...form.details];
    // Tự động viết hoa mã tài khoản nếu người dùng nhập chữ thường
    newDetails[index][field] = field === 'accountCode' ? value.toUpperCase() : value;
    setForm({ ...form, details: newDetails });
  };

  // Thêm một dòng định khoản trống
  const addDetailRow = () => {
    setForm({
      ...form,
      details: [...form.details, { accountCode: '', entryType: 'DR', amount: '' }]
    });
  };

  // Xóa một dòng định khoản
  const removeDetailRow = (index) => {
    if (form.details.length <= 1) return; // Luôn giữ lại ít nhất 1 dòng
    const newDetails = form.details.filter((_, i) => i !== index);
    setForm({ ...form, details: newDetails });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Format lại dữ liệu detail để đảm bảo chuẩn số trước khi tính toán
    const formattedDetails = form.details.map(d => ({
      accountCode: d.accountCode.trim(),
      entryType: d.entryType,
      amount: parseFloat(d.amount) || 0
    }));

    // Kiểm tra ràng buộc cân bằng Nợ = Có trước khi gọi API
    const drSum = formattedDetails.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const crSum = formattedDetails.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + d.amount, 0);

    if (Math.abs(drSum - crSum) > 0.5) {
      alert(`⚠️ Không thể lập phiếu! Tổng vế Nợ (${drSum.toLocaleString()} đ) đang lệch so với Tổng vế Có (${crSum.toLocaleString()} đ).`);
      return;
    }
    
    // Tự động phân loại Thu/Chi dựa vào việc có tài khoản tiền (1111, 1121...) ghi Nợ hay ghi Có
    const hasCashDr = formattedDetails.some(d => (d.accountCode.startsWith('111') || d.accountCode.startsWith('112')) && d.entryType === 'DR');
    const type = hasCashDr ? 'Thu' : 'Chi';

    await createNewVoucher({
      voucherDate: form.date,
      description: form.desc,
      type,
      details: formattedDetails
    });

    // Reset Form về mặc định sạch sẽ
    setForm({
      date: '2026-01-01',
      desc: '',
      details: [
        { accountCode: '1111', entryType: 'DR', amount: '' },
        { accountCode: '131', entryType: 'CR', amount: '' }
      ]
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Wallet className="text-emerald-600" size={24} /> PHÂN HỆ QUỸ TIỀN MẶT & TIỀN GỬI NGÂN HÀNG
        </h1>
        <div className="flex items-center gap-2">
          <ExportExcelButton endpoint="cashbook" filename="So_Quy" label="Xuất sổ quỹ" />
          <ImportExcelButton endpoint="vouchers" filename="So_Nhat_Ky" label="Nhập chứng từ" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM NHẬP MASTER - DETAIL */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm h-fit">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-400">Thông tin chung</label>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
            <input type="text" placeholder="Nội dung nghiệp vụ..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-slate-400">Định khoản hạch toán</label>
              <button type="button" onClick={addDetailRow} className="text-emerald-600 hover:text-emerald-700 font-bold text-[11px] flex items-center gap-0.5">
                <ListPlus size={14} /> Thêm dòng
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {form.details.map((detail, index) => (
                <div key={index} className="flex gap-1.5 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <input type="text" placeholder="TK" value={detail.accountCode} onChange={e => handleDetailChange(index, 'accountCode', e.target.value)} className="w-16 text-xs p-2 bg-white border rounded-lg font-mono uppercase" required />
                  <select value={detail.entryType} onChange={e => handleDetailChange(index, 'entryType', e.target.value)} className="text-xs p-2 bg-white border rounded-lg font-bold text-slate-700">
                    <option value="DR">Nợ (DR)</option>
                    <option value="CR">Có (CR)</option>
                  </select>
                  <input type="number" placeholder="Số tiền..." value={detail.amount} onChange={e => handleDetailChange(index, 'amount', e.target.value)} className="flex-1 text-xs p-2 bg-white border rounded-lg" required />
                  {form.details.length > 1 && (
                    <button type="button" onClick={() => removeDetailRow(index)} className="text-slate-400 hover:text-rose-500 p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-sm hover:bg-emerald-700 transition">
            <Plus size={14} /> Lập Phiếu Ghi Sổ
          </button>
        </form>

        {/* BẢNG HIỂN THỊ CHỨNG TỪ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 col-span-2 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold border-b text-slate-500">
                <th className="p-3">Ngày</th>
                <th className="p-3">Loại</th>
                <th className="p-3">Hạch toán (TK - Số tiền)</th>
                <th className="p-3">Diễn giải</th>
                <th className="p-3 text-right">Tổng tiền</th>
                <th className="p-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {cashVouchers.map(v => {
                // Tính tổng tiền chứng từ (bằng tổng các dòng Nợ DR)
                const totalAmount = v.details?.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0) || 0;

                return (
                  <tr key={v.id} className="border-b hover:bg-slate-50/50 transition align-top">
                    {/* Sửa trường hiển thị từ voucher_date thành voucherDate khớp với API */}
                    <td className="p-3 font-mono text-slate-600">{v.voucherDate?.slice(0, 10)}</td>
                    <td className="p-3">
                      {/* Sửa trường hiển thị từ voucher_type thành type khớp với API */}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v.type === 'Thu' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {v.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono space-y-1">
                      {v.details?.map((dt, idx) => (
                        <div key={idx} className="text-[11px]">
                          <span className={dt.entryType === 'DR' ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold pl-3'}>
                            {dt.entryType} {dt.accountCode}:
                          </span>{' '}
                          <span className="text-slate-600">{(parseFloat(dt.amount) || 0).toLocaleString()} đ</span>
                        </div>
                      ))}
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs break-words">{v.description}</td>
                    <td className="p-3 text-right font-black text-slate-800">{totalAmount.toLocaleString()} đ</td>
                    <td className="p-3 text-center">
                      <button onClick={() => removeVoucher(v.id)} className="text-slate-400 hover:text-rose-600 p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}