import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js'; // Sửa lại đường dẫn tương đối từ views/sales/ sang utils
import { useAuth } from '../../context/AuthContext.jsx'; // Import để lấy công ty đang active
import { Plus, Search, Filter, Phone, Mail, MapPin, Building } from 'lucide-react';

export default function PartnerManagement() {
  // Lấy thông tin công ty đang chọn từ hệ thống Context toàn cục
  const { activeCompany } = useAuth();

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // State bộ lọc hiển thị dữ liệu
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); 

  // State quản lý Form nhập liệu
  const [form, setForm] = useState({
    partner_code: '',
    partner_name: '',
    type: 'customer',
    phone: '',
    email: '',
    address: ''
  });

  // Hàm gọi API lấy danh sách đối tác thuộc riêng công ty đang được chọn
  const fetchPartners = async () => {
    if (!activeCompany?.id) return;
    
    setLoading(true);
    setError('');
    try {
      // ĐÃ SỬA: Gửi kèm query params company_id để backend lọc chính xác dữ liệu pháp nhân
      const res = await api.get(`/api/partners/list?company_id=${activeCompany.id}`);
      if (res.data?.success) {
        setPartners(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể kết nối để tải danh sách đối tác.');
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải lại danh sách đối tác mỗi khi người dùng đổi công ty trên Header
  useEffect(() => {
    fetchPartners();
  }, [activeCompany?.id]);

  // Hàm xử lý gửi dữ liệu thêm mới đối tác lên Backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!activeCompany?.id) {
      setError('Vui lòng chọn công ty làm việc trên hệ thống trước khi thực hiện.');
      return;
    }

    setSubmitLoading(true);

    try {
      // ĐÃ SỬA: Đóng gói dữ liệu form kèm theo id của công ty đang hoạt động
      const payload = { ...form, company_id: activeCompany.id };
      const res = await api.post('/api/partners/create', payload);
      
      if (res.data?.success) {
        setSuccess('Đăng ký thêm mới đối tác thành công!');
        // Reset form về trạng thái trống
        setForm({ partner_code: '', partner_name: '', type: 'customer', phone: '', email: '', address: '' });
        // Tải lại bảng danh sách để cập nhật dòng vừa thêm
        fetchPartners(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình lưu dữ liệu.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Bộ lọc dữ liệu trực tiếp trên RAM giao diện (In-memory Filter)
  const filteredPartners = partners.filter(p => {
    const matchSearch = p.partner_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.partner_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'all' || p.type === filterType || p.type === 'both';
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Tiêu đề phân hệ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 space-y-2 md:space-y-0">
        <div>
          <h1 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building className="text-emerald-600" size={20} /> Danh mục Đối tác
          </h1>
          <p className="text-xs text-slate-400">
            Hồ sơ thông tin Khách hàng, Nhà cung cấp tại: <span className="font-bold text-slate-700">{activeCompany?.company_name || 'Chưa chọn pháp nhân'}</span>
          </p>
        </div>
      </div>

      {/* Hiển thị lỗi hoặc thông báo thành công nếu có */}
      {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-600">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* KHỐI 1: FORM NHẬP LIỆU ĐỐI TÁC */}
        <div className="bg-white p-5 rounded-2xl shadow-xl space-y-4 border border-slate-100">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Plus className="text-emerald-600" size={14} /> Thêm đối tác mới
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mã đối tác (*)</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: KH001, NCC_ABC..."
                value={form.partner_code}
                onChange={e => setForm({ ...form, partner_code: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tên đối tác (*)</label>
              <input
                type="text"
                required
                placeholder="Tên công ty hoặc họ tên cá nhân..."
                value={form.partner_name}
                onChange={e => setForm({ ...form, partner_name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phân loại đối tác</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="customer">Customer (Khách hàng)</option>
                <option value="supplier">Supplier (Nhà cung cấp)</option>
                <option value="both">Both (Vừa là KH vừa là NCC)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Số điện thoại</label>
              <input
                type="text"
                placeholder="Số điện thoại liên lạc..."
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Địa chỉ Email</label>
              <input
                type="email"
                placeholder="partner@company.com..."
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Địa chỉ kinh doanh</label>
              <textarea
                rows="2"
                placeholder="Số nhà, tên đường, khu vực..."
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 mt-2"
            >
              {submitLoading ? 'Đang gửi dữ liệu...' : 'Đăng ký đối tác'}
            </button>
          </form>
        </div>

        {/* KHỐI 2: THANH LỌC VÀ BẢNG DANH SÁCH ĐỐI TÁC */}
        <div className="bg-white p-5 rounded-2xl shadow-xl lg:col-span-2 space-y-4 border border-slate-100">
          
          {/* Thanh công cụ tìm kiếm nhanh */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Tìm theo Mã hoặc Tên đối tác..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Filter size={14} className="text-slate-400" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-transparent text-xs text-slate-600 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả phân loại</option>
                <option value="customer">Chỉ Khách hàng</option>
                <option value="supplier">Chỉ Nhà cung cấp</option>
                <option value="both">Đối tác lai (Both)</option>
              </select>
            </div>
          </div>

          {/* Bảng kết quả hiển thị */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            {loading ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Đang truy xuất dữ liệu từ cơ sở dữ liệu...</div>
            ) : filteredPartners.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Không tìm thấy thông tin đối tác nào.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Mã số</th>
                    <th className="py-3 px-4">Tên hiển thị / Địa chỉ</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Liên lạc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                  {filteredPartners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 tracking-wide">{partner.partner_code}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{partner.partner_name}</div>
                        {partner.address && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {partner.address}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          partner.type === 'customer' ? 'bg-blue-50 text-blue-600' :
                          partner.type === 'supplier' ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {partner.type === 'customer' ? 'KH' : partner.type === 'supplier' ? 'NCC' : 'Both'}
                        </span>
                      </td>
                      <td className="py-3 px-4 space-y-0.5 text-[11px] text-slate-500">
                        {partner.phone && <div className="flex items-center gap-1"><Phone size={10} /> {partner.phone}</div>}
                        {partner.email && <div className="flex items-center gap-1 text-slate-400"><Mail size={10} /> {partner.email}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}