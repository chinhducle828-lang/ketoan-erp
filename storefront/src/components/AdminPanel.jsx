/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { formatPrice } from '../utils/formatters';
import { adminItemApi } from '../utils/api';

const AdminPanel = ({
  items,
  setItems,
  companyId,
  storefrontToken,
  t
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    price_sell: '',
    unit: '',
    category: '',
    description: '',
    image_url: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      price_sell: item.price_sell || '',
      unit: item.unit || '',
      category: item.category || '',
      description: item.description || '',
      image_url: item.image_url || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Xóa sản phẩm ${item.name}?`)) return;
    
    try {
      await adminItemApi.delete(item.code, companyId, storefrontToken);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xóa sản phẩm');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        price_sell: Number(form.price_sell) || 0,
        company_id: Number(companyId)
      };

      if (editingItem) {
        await adminItemApi.update(editingItem.code, payload, storefrontToken);
      } else {
        await adminItemApi.create(payload, storefrontToken);
      }

      setShowForm(false);
      setEditingItem(null);
      setForm({
        name: '',
        code: '',
        price_sell: '',
        unit: '',
        category: '',
        description: '',
        image_url: ''
      });
      setMessage('Lưu thành công');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Lỗi lưu sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between">
        <h3 className="text-lg font-semibold">Quản lý sản phẩm</h3>
        <button
          onClick={() => {
            setEditingItem(null);
            setForm({
              name: '',
              code: '',
              price_sell: '',
              unit: '',
              category: '',
              description: '',
              image_url: ''
            });
            setShowForm(true);
          }}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold"
        >
          + Thêm mới
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h4 className="mb-4 text-lg font-semibold">
              {editingItem ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Tên sản phẩm"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Mã sản phẩm"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="number"
                placeholder="Giá bán"
                value={form.price_sell}
                onChange={(e) => setForm((f) => ({ ...f, price_sell: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Đơn vị"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="text"
                placeholder="Danh mục"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <textarea
                placeholder="Mô tả"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                rows={2}
              />
              <input
                type="text"
                placeholder="URL ảnh"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-emerald-500 py-2 font-semibold"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2"
                >
                  Hủy
                </button>
              </div>
            </form>
            {message && <p className="mt-2 text-sm text-rose-600">{message}</p>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-slate-500">{item.code}</p>
              <p className="text-sm font-bold text-emerald-600">
                {formatPrice(item.price_sell, 'VND')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-sm"
              >
                Sửa
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-sm"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPanel;