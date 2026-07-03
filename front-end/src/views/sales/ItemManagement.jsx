import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';

export default function ItemManagement() {
  const { activeCompany } = useAuth(); 
  const [items, setItems] = useState([]);
  const [form, setForm] = usePersistentState('item-management-form-v2', { code: '', name: '', unit: 'Cái' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (activeCompany) {
      fetchItems();
    }
  }, [activeCompany]);

  const fetchItems = async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError('');
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.get(`/items?company_id=${companyId}`);
      setItems(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kết nối lấy danh mục vật tư!');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      await api.post('/items', { ...form, company_id: companyId });
      setSuccess('Thêm mã vật tư thành công!');
      setForm({ code: '', name: '', unit: 'Cái' });
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi trùng mã hoặc dữ liệu không hợp lệ!');
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Xác nhận xóa vật tư mã ${code}?`)) return;
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      await api.delete(`/items/${code}?company_id=${companyId}`);
      setSuccess('Đã xóa vật tư!');
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể xóa mã vật tư đang sử dụng!');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Package className="text-blue-600" size={22} /> Danh Mục Vật Tư - Kho Hàng</h1>
          <p className="text-slate-400 text-xs font-medium">Khai báo mã hàng hóa động đồng bộ tài khoản kho dồn tích</p>
        </div>
        <button onClick={fetchItems} className="p-2 border rounded-xl hover:bg-slate-50 transition"><RefreshCw size={16}/></button>
      </div>

      {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl font-bold">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl font-bold">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5"><Plus size={16}/> Thêm Mã Hàng Mới</h3>
          <input type="text" placeholder="Mã SKU (Vd: NGUYENLIEU01)" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="w-full p-2.5 border rounded-xl text-sm font-mono" required />
          <input type="text" placeholder="Tên quy cách vật tư" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-semibold" required />
          <input type="text" placeholder="Đơn vị tính (Cái, Kg, Mét...)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm" required />
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm">Lưu Vào Hệ Thống</button>
        </form>

        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b">
              <tr>
                <th className="p-3">Mã SKU</th>
                <th className="p-3">Tên sản phẩm vật tư</th>
                <th className="p-3">Đơn vị</th>
                <th className="p-3 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Chưa có mã vật tư nào cho doanh nghiệp này.</td>
                </tr>
              ) : (
                items.map(i => (
                  /* KẾT HỢP KEY AN TOÀN TRÁNH TRÙNG LẶP DOM KHI CHUYỂN ĐỔI DOANH NGHIỆP */
                  <tr key={i.id || `${i.company_id}-${i.code}`} className="hover:bg-slate-50/50 transition border-b border-slate-50">
                    <td className="p-3 font-mono font-bold text-blue-600">{i.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{i.name}</td>
                    <td className="p-3"><span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">{i.unit}</span></td>
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