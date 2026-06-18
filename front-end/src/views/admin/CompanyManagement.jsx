import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AddCompanyForm from './AddCompanyForm.jsx';
import CompanyList from './CompanyList.jsx';
import { ShieldAlert, Users, UserPlus, Trash2 } from 'lucide-react';

export default function CompanyManagement() {
  const { fetchCompanies, companies, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);

  // States quản lý Form thêm nhân viên mới
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('nv');
  const [newCompanyId, setNewCompanyId] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  // Thay đổi đơn vị công tác trực tiếp trên bảng
  const handleAssign = async (userId, companyId) => {
    try {
      const currentU = users.find(u => u.id === userId);
      // Chống xử lý nếu lỡ kích hoạt trên tài khoản admin
      if (currentU?.role === 'admin') return;

      await api.post('/api/auth/assign-company', { 
        userId, 
        companyId: companyId ? Number(companyId) : null,
        role: currentU?.role || 'nv'
      });
      loadUsers();
    } catch (err) { alert('Lỗi gán quyền'); }
  };

  // Thay đổi Vai trò trực tiếp trên bảng
  const handleRoleChange = async (userId, newRole) => {
    try {
      const currentU = users.find(u => u.id === userId);
      // Ngăn chặn hạ cấp hoặc thay đổi vai trò nếu tài khoản hiện tại đang là admin
      if (currentU?.role === 'admin') return;

      await api.post('/api/auth/assign-company', { 
        userId, 
        companyId: currentU?.company_id || null,
        role: newRole 
      });
      loadUsers();
    } catch (err) { alert('Lỗi cập nhật vai trò'); }
  };

  // Xử lý Thêm nhân sự mới
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      alert('Vui lòng nhập tài khoản và mật khẩu!');
      return;
    }
    try {
      await api.post('/api/users', {
        username: newUsername,
        password: newPassword,
        role: newRole,
        companyId: newRole === 'admin' ? null : (newCompanyId ? Number(newCompanyId) : null)
      });
      alert('Thêm nhân sự mới thành công!');
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi thêm nhân sự mới!');
    }
  };

  // Xử lý Xóa nhân sự
  const handleDeleteUser = async (userId, username) => {
    if (userId === currentUser?.id) {
      alert('Bạn không thể tự xóa tài khoản của chính mình!');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" khỏi hệ thống?`)) return;
    
    try {
      await api.delete(`/api/users/${userId}`);
      alert('Đã xóa nhân sự thành công!');
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xóa nhân sự!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <ShieldAlert className="text-blue-600" size={24} />
          CẤU HÌNH HỆ THỐNG VÀ PHÂN QUYỀN DOANH NGHIỆP
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI (Bao gồm form Công ty và Form Nhân sự mới) */}
        <div className="space-y-6 col-span-1">
          {/* Form thêm công ty gốc */}
          <AddCompanyForm onRefresh={fetchCompanies} />

          {/* Form thêm nhân sự mới bổ sung */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus size={16} className="text-emerald-600" /> Khai báo nhân sự mới
            </h3>
            
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Tên tài khoản nhân viên..."
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Mật khẩu ban đầu..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none"
                >
                  <option value="nv">Nhân viên (nv)</option>
                  <option value="ktt">Kế toán trưởng (ktt)</option>
                  <option value="admin">Quản trị viên (admin)</option>
                </select>

                <select
                  value={newRole === 'admin' ? '' : newCompanyId}
                  onChange={(e) => setNewCompanyId(e.target.value)}
                  disabled={newRole === 'admin'}
                  className={`w-full text-xs border rounded-xl p-2.5 focus:outline-none font-bold ${
                    newRole === 'admin' 
                      ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed' 
                      : 'bg-slate-50 border-slate-200 text-blue-600'
                  }`}
                >
                  <option value="">-- Chọn đơn vị --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full text-xs font-black tracking-wider uppercase bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl transition shadow-sm"
              >
                + Tạo tài khoản nhân sự
              </button>
            </form>
          </div>
        </div>

        {/* CỘT PHẢI (Danh sách hiển thị có nút xóa bảo vệ hệ thống) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={16} /> Danh sách người dùng và gán đơn vị công tác
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <th className="p-3">Tên tài khoản</th>
                  <th className="p-3">Vai trò</th>
                  <th className="p-3">Cơ sở làm việc được chỉ định</th>
                  <th className="p-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const isAdmin = u.role === 'admin';
                  
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-700">{u.username}</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={isAdmin}
                          className={`border rounded-lg p-1 text-[10px] font-black uppercase focus:outline-none ${
                            isAdmin 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed' 
                              : 'bg-slate-50 border-slate-200 text-blue-600'
                          }`}
                        >
                          <option value="admin">ADMIN</option>
                          <option value="ktt">KTT</option>
                          <option value="nv">NV</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select 
                          value={isAdmin ? '' : (u.company_id || '')} 
                          onChange={(e) => handleAssign(u.id, e.target.value)}
                          disabled={isAdmin}
                          className={`w-full border rounded-xl p-1.5 focus:outline-none text-slate-700 ${
                            isAdmin 
                              ? 'bg-amber-50 border-amber-200 font-bold text-amber-700 cursor-not-allowed' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <option value="">-- Để trống / Toàn quyền hệ thống --</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        {u.id !== currentUser?.id && !isAdmin && (
                          <>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                              title="Xóa nhân sự"
                            >
                              <Trash2 size={15} />
                            </button>

                            {currentUser?.role === 'admin' && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Reset mật khẩu cho ${u.username}? Mật khẩu tạm thời sẽ được hiển thị cho Admin.`)) return;
                                  try {
                                    const res = await api.post('/api/auth/admin-reset-password', { userId: u.id });
                                    alert(`Mật khẩu tạm thời: ${res.data.tempPassword}\nYêu cầu người dùng đổi mật khẩu khi đăng nhập.`);
                                  } catch (err) { alert(err.response?.data?.error || 'Lỗi reset mật khẩu'); }
                                }}
                                className="ml-2 p-1.5 text-slate-400 hover:text-amber-600 rounded-xl hover:bg-amber-50 transition"
                                title="Reset mật khẩu"
                              >
                                <UserPlus size={15} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Danh sách công ty */}
      <CompanyList companies={companies} onRefresh={fetchCompanies} />
    </div>
  );
}