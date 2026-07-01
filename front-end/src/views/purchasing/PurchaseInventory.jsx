import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { ShoppingBag, Plus } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function PurchaseInventory() {
  const { createNewVoucher } = useVouchers();
  const [form, setForm] = usePersistentState('purchase-inventory-form-v2', { 
    item: '', 
    amount: '', 
    tax: '10' 
  });

  const handlePurchase = async (e) => {
    e.preventDefault();
    const baseAmount = parseFloat(form.amount) || 0;
    const taxRate = parseFloat(form.tax) || 0;
    const taxAmount = Math.round(baseAmount * (taxRate / 100));
    const totalPay = baseAmount + taxAmount;

    if (baseAmount <= 0 || !form.item.trim()) {
      alert('Vui lòng nhập tên hàng hóa và giá trị hợp lệ!');
      return;
    }

    // Khởi tạo mảng chi tiết hạch toán (Master-Detail)
    const details = [
      {
        accountCode: '156', // Ghi Nợ 156 - Giá trị mua trước thuế
        entryType: 'DR',
        amount: baseAmount
      }
    ];

    // Nếu có thuế thì đẩy thêm dòng Nợ 1331 vào mảng chi tiết
    if (taxAmount > 0) {
      details.push({
        accountCode: '1331', // Ghi Nợ 1331 - Thuế GTGT đầu vào
        entryType: 'DR',
        amount: taxAmount
      });
    }

    // Đẩy dòng tổng tiền đối ứng Có 331 (Phải trả người bán)
    details.push({
      accountCode: '331', // Ghi Có 331 - Tổng giá trị thanh toán
      entryType: 'CR',
      amount: totalPay
    });

    // Bắn 1 API duy nhất gửi trọn vẹn cả nghiệp vụ mua hàng lên Backend
    try {
      await createNewVoucher({
        voucherDate: '2026-01-15',
        description: `Mua nhập kho hàng hóa: ${form.item} (Gồm thuế GTGT ${taxRate}%)`,
        type: 'Nhap',
        details: details // Gửi mảng chi tiết đa dòng
      });

      alert(`Đã hạch toán nhập kho hàng hóa thành công!\n- Tiền hàng (156): ${baseAmount.toLocaleString()} đ\n- Thuế vào (1331): ${taxAmount.toLocaleString()} đ\n- Tổng công nợ (331): ${totalPay.toLocaleString()} đ`);
      setForm({ item: '', amount: '', tax: '10' });
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi lưu chứng từ mua hàng.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <ShoppingBag className="text-emerald-600" size={24} /> PHÂN HỆ MUA HÀNG VÀ HẠCH TOÁN VẬT TƯ NHẬP KHO
        </h1>
        <ExportExcelButton endpoint="purchases" filename="Mua_Hang_Nhap_Kho" label="Xuất Excel" />
      </div>

      <form onSubmit={handlePurchase} className="bg-white p-5 rounded-2xl border shadow-sm max-w-md space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tên mặt hàng</label>
          <input type="text" placeholder="Tên nguyên vật liệu / Hàng hóa nhập kho..." value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Giá trị mua trước thuế</label>
          <input type="number" placeholder="Giá trị mua trước thuế (VND)..." value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Thuế suất GTGT đầu vào</label>
          <select value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-medium text-slate-700">
            <option value="0">Thuế suất GTGT: 0%</option>
            <option value="5">Thuế suất GTGT: 5%</option>
            <option value="10">Thuế suất GTGT: 10%</option>
          </select>
        </div>

        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-1">
          <Plus size={14} /> Phát hành chứng từ mua kho
        </button>
      </form>
    </div>
  );
}

//    