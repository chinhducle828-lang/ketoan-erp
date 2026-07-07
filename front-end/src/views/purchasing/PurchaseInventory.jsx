import React, { useState, useEffect, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { ShoppingBag, Loader2, Plus, Package } from 'lucide-react';
import { buildPurchaseInventoryDetails, getDefaultCurrency, getDefaultTaxRate } from '../../utils/accountingRules.js';

export default function PurchaseInventory() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ code: '', name: '', unit: 'Cái', price_sell: '' });

  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [tax, setTax] = useState(String(getDefaultTaxRate() * 100));
  const [partnerId, setPartnerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchItems = async () => {
    if (!companyId) return;
    setItemsLoading(true);
    try {
      const res = await api.get(`/items?company_id=${companyId}`);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Lỗi tải danh mục vật tư:', err);
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const selectedItem = useMemo(
    () => items.find((it) => String(it.id) === String(selectedItemId)) || null,
    [items, selectedItemId]
  );

  // Tự động điền đơn giá khi chọn item có sẵn
  useEffect(() => {
    if (selectedItem && !showNewItem) {
      const suggested = Number(selectedItem.price_sell) || 0;
      if (suggested > 0) setUnitCost(String(suggested));
    }
  }, [selectedItem, showNewItem]);

  const handleCreateItem = async () => {
    if (!newItem.code.trim() || !newItem.name.trim() || !newItem.unit.trim()) {
      return alert('Vui lòng nhập mã, tên và đơn vị tính cho vật tư mới!');
    }
    if (!companyId) return alert('Vui lòng chọn doanh nghiệp!');

    try {
      const payload = new FormData();
      payload.append('code', newItem.code.trim().toUpperCase());
      payload.append('name', newItem.name.trim());
      payload.append('unit', newItem.unit.trim());
      payload.append('price_sell', newItem.price_sell || 0);
      payload.append('company_id', companyId);

      await api.post('/items', payload);
      alert('Đã tạo vật tư mới trong danh mục chung!');
      setNewItem({ code: '', name: '', unit: 'Cái', price_sell: '' });
      setShowNewItem(false);
      await fetchItems();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi tạo vật tư mới!');
    }
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const qty = Math.max(1, Number(quantity || 1));
    const unitPrice = Math.round(parseFloat(unitCost) || 0);
    const baseAmount = unitPrice * qty;

    if (baseAmount <= 0) return alert('Vui lòng nhập đơn giá và số lượng hợp lệ!');
    if (!companyId) return alert('Vui lòng chọn doanh nghiệp!');

    // Xác định item_id: ưu tiên item chọn sẵn, nếu tạo mới thì phải tạo trước
    let itemId = null;
    let itemName = '';

    if (showNewItem) {
      if (!newItem.code.trim() || !newItem.name.trim()) {
        return alert('Vui lòng điền đầy đủ thông tin vật tư mới hoặc chọn vật tư có sẵn!');
      }
      try {
        const payload = new FormData();
        payload.append('code', newItem.code.trim().toUpperCase());
        payload.append('name', newItem.name.trim());
        payload.append('unit', newItem.unit.trim());
        payload.append('price_sell', newItem.price_sell || unitPrice);
        payload.append('company_id', companyId);

        await api.post('/items', payload);
        await fetchItems();
        itemName = newItem.name.trim();
        // Lấy id vật tư vừa tạo
        const refreshed = await api.get(`/items?company_id=${companyId}`);
        const created = (refreshed.data || []).find(
          (it) => String(it.code).toUpperCase() === newItem.code.trim().toUpperCase()
        );
        itemId = created?.id || null;
        setNewItem({ code: '', name: '', unit: 'Cái', price_sell: '' });
        setShowNewItem(false);
      } catch (err) {
        return alert(err.response?.data?.error || 'Lỗi tạo vật tư mới!');
      }
    } else {
      if (!selectedItemId) return alert('Vui lòng chọn vật tư từ danh mục!');
      itemId = selectedItem?.id || null;
      itemName = selectedItem?.name || '';
    }

    setLoading(true);
    const details = buildPurchaseInventoryDetails({
      baseAmount,
      quantity: qty,
      partnerId: partnerId || null,
      itemId,
      itemName,
      taxRate: parseFloat(tax) || 0
    });

    const payload = {
      companyId: parseInt(companyId, 10),
      voucherDate: new Date().toISOString().split('T')[0],
      type: 'NK',
      description: `Nhập kho: ${itemName || 'vật tư'} (${qty} ${selectedItem?.unit || newItem.unit || 'Cái'})`,
      currency: getDefaultCurrency(),
      exchangeRate: 1,
      details
    };

    try {
      const result = await createNewVoucher(payload);
      if (result?.success) {
        setSuccess('Đã ghi sổ phiếu nhập kho thành công!');
        setSelectedItemId('');
        setQuantity('1');
        setUnitCost('');
        setPartnerId('');
      } else {
        setError(result?.error || 'Lỗi hệ thống khi ghi sổ!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi hệ thống!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl p-6 bg-white rounded-3xl border border-slate-100 shadow-sm mx-auto mt-6">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="text-indigo-600" size={24} />
        <h2 className="font-black text-slate-800 text-lg uppercase">Nhập Kho Mua Hàng</h2>
      </div>

      {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold mb-4">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-bold mb-4">{success}</div>}

      <form onSubmit={handlePurchase} className="space-y-4">
        {/* Chọn vật tư từ catalog */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vật tư / Hàng hóa từ danh mục</label>
          <div className="flex gap-2">
            <select
              value={selectedItemId}
              onChange={(e) => { setSelectedItemId(e.target.value); setShowNewItem(false); }}
              disabled={showNewItem || itemsLoading}
              className="flex-1 text-xs p-2.5 bg-slate-50 border rounded-xl outline-none"
            >
              <option value="">-- Chọn vật tư có sẵn --</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.code} - {it.name} ({it.unit})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setShowNewItem((s) => !s); setSelectedItemId(''); }}
              className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> {showNewItem ? 'Chọn có sẵn' : 'Tạo mới'}
            </button>
          </div>
        </div>

        {/* Form tạo vật tư mới */}
        {showNewItem && (
          <div className="p-3 bg-indigo-50 rounded-xl space-y-2 border border-indigo-100">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-indigo-500">
              <Package size={12} /> Thông tin vật tư mới
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text" placeholder="Mã SKU" value={newItem.code}
                onChange={(e) => setNewItem({ ...newItem, code: e.target.value.toUpperCase() })}
                className="w-full text-xs p-2 border rounded-lg"
              />
              <input
                type="text" placeholder="Đơn vị tính" value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full text-xs p-2 border rounded-lg"
              />
            </div>
            <input
              type="text" placeholder="Tên vật tư / hàng hóa" value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full text-xs p-2 border rounded-lg"
            />
            <div className="flex gap-2 items-center">
              <input
                type="number" placeholder="Giá bán (tùy chọn)" value={newItem.price_sell}
                onChange={(e) => setNewItem({ ...newItem, price_sell: e.target.value })}
                className="flex-1 text-xs p-2 border rounded-lg"
              />
              <button
                type="button" onClick={handleCreateItem}
                className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg"
              >
                Lưu vật tư
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Số lượng</label>
            <input
              type="number" min="1" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Đơn giá (VND)</label>
            <input
              type="number" value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Thuế suất GTGT</label>
            <select value={tax} onChange={(e) => setTax(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none">
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Đối tác công nợ (331)</label>
            <input
              type="number" value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="ID đối tác" className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
          Thành tiền (chưa thuế): <b>{(Math.round(parseFloat(unitCost) || 0) * Math.max(1, Number(quantity || 1))).toLocaleString('vi-VN')} đ</b>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center items-center mt-2 transition"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ghi sổ Phiếu Nhập Kho (NK)'}
        </button>
      </form>
    </div>
  );
}