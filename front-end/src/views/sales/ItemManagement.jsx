/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';
import { useRealtimeCacheSync } from '../../hooks/useRealtimeCacheSync.js';

export default function ItemManagement() {
  const { activeCompany } = useAuth(); 
  const companyId = activeCompany?.id ?? activeCompany;
  
  const [form, setForm] = usePersistentState('item-management-form-v2', {
    code: '',
    name: '',
    description: '',
    unit: 'Cái',
    price_sell: ''
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // React Query for items
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['items', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await api.get(`/items?company_id=${companyId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Realtime cache sync
  useRealtimeCacheSync({
    queries: [
      { key: ['items', companyId] }
    ],
    events: ['voucherCreated', 'voucherUpdated', 'voucherDeleted'],
    enabled: !!companyId
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!activeCompany?.id && !activeCompany) {
      setError('Vui lòng chọn doanh nghiệp trước khi thêm sản phẩm.');
      return;
    }

    try {
      const payload = new FormData();
      payload.append('code', form.code.trim());
      payload.append('name', form.name.trim());
      payload.append('description', form.description?.trim() || '');
      payload.append('unit', form.unit.trim());
      payload.append('price_sell', form.price_sell || 0);
      payload.append('company_id', companyId);

      selectedFiles.forEach((file) => payload.append('images', file));

      await api.post('/items', payload);
      setSuccess('Đã lưu sản phẩm thành công lên gian hàng!');
      setForm({ code: '', name: '', description: '', unit: 'Cái', price_sell: '' });
      setSelectedFiles([]);
      // Invalidate items query to refetch
      refetchItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi trùng mã hoặc dữ liệu không hợp lệ!');
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Xác nhận xóa vật tư mã ${code}?`)) return;
    try {
      await api.delete(`/items/${code}?company_id=${companyId}`);
      setSuccess('Đã xóa vật tư!');
      // Invalidate items query to refetch
      refetchItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xóa mã vật tư đang sử dụng!');
    }
  };

  const handleFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const previewUrls = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Package className="text-blue-600" size={22} /> Quản Lý Sản Phẩm Web</h1>
          <p className="text-slate-500 text-sm">Giám đốc / Kế toán trưởng khai báo sản phẩm vật liệu lên gian hàng trực tuyến.</p>
          <p className="text-slate-400 text-xs font-medium">Sản phẩm lưu vào danh mục chung của doanh nghiệp, đồng bộ lên store công khai.</p>
        </div>
          <button onClick={() => refetchItems()} className="p-2 border rounded-xl hover:bg-slate-50 transition"><RefreshCw size={16}/></button>
      </div>

      {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-bold">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5"><Plus size={16}/> Thêm sản phẩm lên gian hàng</h3>
          <input type="text" placeholder="Mã SKU (vd. NGUYENLIEU01)" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="w-full p-2.5 border rounded-xl text-sm font-mono" required />
          <input type="text" placeholder="Tên sản phẩm / vật liệu" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-semibold" required />
          <textarea
            rows={3}
            placeholder="Mô tả ngắn hiển thị trên storefront (popup xem nhanh)"
            value={form.description || ''}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full p-2.5 border rounded-xl text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="text" placeholder="Đơn vị tính (Cái, Kg, Mét...)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" required />
            <input type="number" min="0" step="1000" placeholder="Giá bán (VND)" value={form.price_sell} onChange={e => setForm({...form, price_sell: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" required />
          </div>
          <label className="block text-sm text-slate-600">
            <span>Hình ảnh sản phẩm</span>
            <input type="file" multiple accept="image/*" onChange={handleFilesChange} className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-sm file:text-white" />
          </label>
          {previewUrls.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {previewUrls.map((src, index) => (
                <img key={index} src={src} alt={`Preview ${index + 1}`} className="h-20 w-full rounded-2xl object-cover border border-slate-200" />
              ))}
            </div>
          )}
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm">Lưu vào gian hàng</button>
        </form>

        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
              <tr>
                <th className="p-3">Mã SKU</th>
                <th className="p-3">Tên sản phẩm</th>
                <th className="p-3">Đơn vị</th>
                <th className="p-3">Giá</th>
                <th className="p-3">Ảnh chính</th>
                <th className="p-3">Số ảnh</th>
                <th className="p-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-medium">Chưa có mã vật tư nào cho doanh nghiệp này.</td>
                </tr>
              ) : (
                items.map(i => (
                  /* KẾT HỢP KEY AN TOÀN TRÁNH TRÙNG LẶP DOM KHI CHUYỂN ĐỔI DOANH NGHIỆP */
                  <tr key={i.id || `${i.company_id}-${i.code}`} className="hover:bg-slate-50/50 transition border-b border-slate-50">
                    <td className="p-3 font-mono font-bold text-blue-600">{i.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{i.name}</td>
                    <td className="p-3"><span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">{i.unit}</span></td>
                    <td className="p-3 font-semibold text-slate-900">{Number(i.price_sell || 0).toLocaleString('vi-VN')} ₫</td>
                    <td className="p-3">
                      {(i.image_urls?.length > 0 ? i.image_urls[0] : i.image_url) ? (
                        <img src={i.image_urls?.[0] || i.image_url} alt={i.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">Chưa có</div>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{(i.image_urls?.length || (i.image_url ? 1 : 0))}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDelete(i.code)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}