import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function FixedAssets() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const [assets, setAssets] = useState([]);
  const [form, setForm] = usePersistentState('fixed-assets-form-v2', { 
    id: '', 
    name: '', 
    originalPrice: '', 
    life: 60, 
    deptCode: '6422', 
    date: '2026-01-01' 
  });
  const [msg, setMsg] = useState('');

  // SỬA LOGIC LỌC: Kiểm tra xem trong mảng details của chứng từ có chứa tài khoản 211 hay không
  const assetVouchers = vouchers.filter(v => 
    v.details?.some(d => d.accountCode?.startsWith('211'))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(form.originalPrice) || 0;
    
    if (price <= 0 || !form.id.trim() || !form.name.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin và nguyên giá hợp lệ!');
      return;
    }

    // Cấu trúc mảng chi tiết hạch toán tự động (Master-Detail) cho nghiệp vụ ghi tăng TSCĐ
    const details = [
      {
        accountCode: '211', // Ghi Nợ 211 - Tăng tài sản cố định hữu hình
        entryType: 'DR',
        amount: price
      },
      {
        accountCode: '331', // Ghi Có 331 - Phải trả người bán (hoặc đối ứng 1111/1121 tùy nghiệp vụ)
        entryType: 'CR',
        amount: price
      }
    ];

    try {
      // Gọi API tạo chứng từ với cấu trúc mới
      await createNewVoucher({
        voucherDate: form.date,
        description: `Ghi tăng TSCĐ: ${form.name} (Mã: ${form.id})`,
        type: 'Khac',
        details: details // Truyền mảng chi tiết định khoản
      });

      // Lưu vào danh sách theo dõi tài sản tạm thời trên giao diện
      setAssets([...assets, { ...form, originalPrice: price, life: parseInt(form.life) }]);
      
      setMsg('Ghi tăng tài sản và hạch toán tự động Nợ 211 / Có 331 thành công!');
      setForm({ id: '', name: '', originalPrice: '', life: 60, deptCode: '6422', date: '2026-01-01' });
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error(error);
      alert('Lỗi hệ thống, không thể tự động sinh chứng từ kế toán!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Calculator className="text-emerald-600" size={24} /> PHÂN HỆ TÀI SẢN CỐ ĐỊNH & KHẤU HAO (211 - 214)
        </h1>
        <ExportExcelButton endpoint="fixed-assets" filename="Tai_San_Co_Dinh" label="Xuất Excel" />
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold animate-fade-in">
          ✅ {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form khai báo tài sản */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm h-fit">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Khai báo tài sản tăng mới</h3>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
          <input type="text" placeholder="Mã tài sản (ID)..." required value={form.id} onChange={e => setForm({...form, id: e.target.value.toUpperCase().trim()})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-mono" />
          <input type="text" placeholder="Tên tài sản..." required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="number" placeholder="Nguyên giá (VND)..." required value={form.originalPrice} onChange={e => setForm({...form, originalPrice: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 transition">
            <Plus size={14} /> Thêm & Sinh Chứng Từ
          </button>
        </form>

        {/* Bảng theo dõi và hạch toán */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 col-span-2 shadow-sm space-y-6 overflow-x-auto">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Sổ theo dõi tài sản cố định</h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-500 border-b">
                  <th className="p-2.5">Mã tài sản</th>
                  <th className="p-2.5">Tên tài sản</th>
                  <th className="p-2.5 text-right">Nguyên giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-4 text-slate-400">Chưa khai báo tài sản nào trong phiên làm việc này.</td>
                  </tr>
                ) : (
                  assets.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-2.5 font-mono font-bold text-blue-600">{a.id}</td>
                      <td className="p-2.5 font-medium text-slate-800">{a.name}</td>
                      <td className="p-2.5 text-right font-bold">{a.originalPrice.toLocaleString()} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* BẢNG CHỨNG TỪ LIÊN QUAN ĐẾN TÀI SẢN 211 */}
          <div className="pt-4 border-t border-dashed">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Các chứng từ ghi tăng (TK 211) hệ thống tự động phát sinh</h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-500 border-b">
                  <th className="p-2.5">Ngày hạch toán</th>
                  <th className="p-2.5">Nội dung / Diễn giải</th>
                  <th className="p-2.5">Định khoản chi tiết</th>
                  <th className="p-2.5 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assetVouchers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-slate-400">Chưa phát sinh chứng từ kế toán liên quan đến TK 211.</td>
                  </tr>
                ) : (
                  assetVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition align-top">
                      <td className="p-2.5 font-mono text-slate-600">{v.voucher_date?.slice(0, 10)}</td>
                      <td className="p-2.5 text-slate-700 font-medium max-w-xs break-words">{v.description}</td>
                      <td className="p-2.5 font-mono space-y-1">
                        {v.details?.map((dt, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className={dt.entryType === 'DR' ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold pl-3'}>
                              {dt.entryType} {dt.accountCode}:
                            </span>{' '}
                            <span className="text-slate-600">{parseFloat(dt.amount).toLocaleString()} đ</span>
                          </div>
                        ))}
                      </td>
                      <td className="p-2.5 text-center">
                        <button onClick={() => removeVoucher(v.id)} className="text-slate-400 hover:text-rose-600 p-1 rounded transition">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}