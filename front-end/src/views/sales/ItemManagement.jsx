import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';

export default function ItemManagement() {
  const { activeCompany } = useAuth(); // Theo dõi công ty đang làm việc từ Header
  const [items, setItems] = useState([]);
  const [form, setForm] = usePersistentState('item-management-form', { code: '', name: '', unit: 'Cái' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tự động tải lại danh sách khi vào phân hệ hoặc khi người dùng chuyển đổi công ty
  useEffect(() => {
    if (activeCompany) {
      fetchItems();
    }
  }, [activeCompany]);

  // 1. ĐỌC DANH SÁCH: Đã bổ sung tham số ?company_id phục vụ tài khoản Admin xem chéo
  const fetchItems = async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/items?company_id=${activeCompany}`);
      setItems(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kết nối lấy danh mục vật tư!');
    } finally {
      setLoading(false);
    }
  };

  // 2. THÊM MỚI VẬT TƯ: Gửi kèm companyId để Backend nhận diện đúng thực thể hạch toán
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!activeCompany) {
      setError('Vui lòng chọn một doanh nghiệp trên thanh công cụ trước!');
      return;
    }
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/api/items', {
        code: form.code.toUpperCase().trim(), // Chuẩn hóa viết hoa mã SKU
        name: form.name.trim(),
        unit: form.unit.trim(),
        companyId: activeCompany // Truyền mã doanh nghiệp hiện tại
      });
      
      if (res.data.success) {
        setSuccess('Đăng ký mã vật tư mới thành công!');
        setForm({ code: '', name: '', unit: 'Cái' });
        fetchItems(); // Tải lại danh sách sau khi lưu
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi hệ thống khi đăng ký vật tư!');
    }
  };

  // 3. XÓA VẬT TƯ: Truyền company_id qua URL để khớp chính xác với Khóa chính phức hợp ở DB
  const handleDelete = async (code) => {
    if (!window.confirm(`Xóa sản phẩm "${code}"? Hành động này không thể hoàn tác.`)) return;
    setError('');
    setSuccess('');

    try {
      const res = await api.delete(`/api/items/${code}?company_id=${activeCompany}`);
      if (res.data.success) {
        setSuccess('Đã xóa vật tư thành công khỏi hệ thống!');
        fetchItems(); // Tải lại danh sách sau khi xóa
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Không có quyền hoặc lỗi khi xóa vật tư này!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Package className="text-amber-600" size={24} /> 
          DANH MỤC MÃ VẬT TƯ, SẢN PHẨM HÀNG HÓA TỒN KHO
        </h1>
        <button 
          onClick={fetchItems} 
          disabled={loading}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all flex items-center gap-1 text-xs font-semibold border bg-white"
          title="Tải lại danh sách"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-amber-600' : ''} />
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Box Hiển thị thông báo trạng thái */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl animate-fade-in">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl animate-fade-in">
          ✅ {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Đăng ký */}
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-2xl border shadow-sm space-y-3 h-fit">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-1">Khai báo mã mới</h3>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Mã Vật Tư (SKU)</label>
            <input 
              type="text" 
              placeholder="Ví dụ: NVL001, SP002..." 
              required 
              value={form.code} 
              onChange={e => setForm({...form, code: e.target.value})} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 transition" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Tên quy cách</label>
            <input 
              type="text" 
              placeholder="Tên chi tiết sản phẩm..." 
              required 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 transition" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Đơn vị tính</label>
            <input 
              type="text" 
              placeholder="Cái, Kg, Thùng, Mét..." 
              required 
              value={form.unit} 
              onChange={e => setForm({...form, unit: e.target.value})} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-amber-500 transition" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 transition text-white font-bold text-xs py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1"
          >
            <Plus size={16} /> Đăng ký mã mới
          </button>
        </form>

        {/* Bảng Dữ Liệu Thực */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm col-span-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 font-bold border-b text-slate-500">
                  <th className="p-3 w-1/4">Mã SKU</th>
                  <th className="p-3 w-1/2">Tên vật tư hàng hóa</th>
                  <th className="p-3 w-1/6">ĐVT</th>
                  <th className="p-3 text-center w-1/12">Hành động</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 font-medium divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400 font-semibold">
                      {loading ? 'Đang tải dữ liệu danh mục...' : 'Chưa có vật tư nào được tạo cho doanh nghiệp này.'}
                    </td>
                  </tr>
                ) : (
                  items.map(i => (
                    <tr key={i.code} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-bold text-blue-600">{i.code}</td>
                      <td className="p-3 font-semibold text-slate-800">{i.name}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {i.unit}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleDelete(i.code)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" 
                          title="Xóa sản phẩm"
                        >
                          <Trash2 size={16} />
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