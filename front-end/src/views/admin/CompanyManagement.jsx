import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AddCompanyForm from './AddCompanyForm.jsx';
import CompanyList from './CompanyList.jsx';
import { ShieldAlert, Users, UserPlus, Trash2, KeyRound } from 'lucide-react';

export default function CompanyManagement() {
  // Lấy danh sách users và hàm loadUsers trực tiếp từ Context chung của hệ thống
  const { fetchCompanies, companies, user: currentUser, users, loadUsers } = useAuth();

  // States quản lý Form thêm nhân viên mới
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('nv');
  const [newCompanyId, setNewCompanyId] = useState('');

  // Tải lại dữ liệu nhân sự mỗi khi component được kích hoạt (đồng bộ chuyển tab)
  useEffect(() => {
    loadUsers();
  }, []);

  // Thay đổi đơn vị công tác trực tiếp trên bảng
  const handleAssign = async (userId, companyId) => {
    const targetCompanyId = companyId ? Number(companyId) : null;
    const targetUser = users.find(u => u.id === userId);

    // BẢO VỆ TÀI KHOẢN ROOT: Không ai được phép gán hay đổi đơn vị của root
    if (targetUser?.username === 'admin') {
      alert('Không thể cấu hình đơn vị công tác cho tài khoản Root!');
      return;
    }
    
    try {
      await api.post('/api/auth/assign-company', { 
        userId, 
        companyId: targetCompanyId,
        role: targetUser?.role || 'nv'
      });
      
      await loadUsers(); // Gọi bất đồng bộ hoàn tất để đồng bộ toàn cục
    } catch (err) { 
      alert('Lỗi gán quyền đơn vị'); 
      await loadUsers(); 
    }
  };

  // Thay đổi Vai trò trực tiếp trên bảng
  const handleRoleChange = async (userId, newRole) => {
    const targetUser = users.find(u => u.id === userId);

    // BẢO VỆ TÀI KHOẢN ROOT: Ngăn chặn tuyệt đối tương tác ngược hay hạ quyền root
    if (targetUser?.username === 'admin') {
      alert('Cấm tuyệt đối hành vi tương tác hoặc thay đổi vai trò của tài khoản Root hệ thống!');
      return;
    }

    // Không cho tự hạ quyền chính mình
    if (userId === currentUser?.id) {
      alert('Bạn không thể tự thay đổi vai trò của chính mình!');
      return;
    }

    try {
      await api.post('/api/auth/assign-company', { 
        userId, 
        companyId: newRole === 'admin' ? null : (targetUser?.company_id || null),
        role: newRole 
      });
      await loadUsers();
    } catch (err) { 
      alert('Lỗi cập nhật vai trò'); 
      await loadUsers();
    }
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
      setNewCompanyId('');
      setNewRole('nv');
      
      await loadUsers(); // Kích hoạt nạp lại dữ liệu trung tâm cho tất cả các phân hệ hiển thị bên ngoài
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi thêm nhân sự mới!');
    }
  };

  // Xử lý Xóa nhân sự
  const handleDeleteUser = async (userId, username) => {
    if (username === 'admin') {
      alert('Tài khoản Root hệ thống là bất tử, không thể xóa!');
      return;
    }
    if (userId === currentUser?.id) {
      alert('Bạn không thể tự xóa tài khoản của chính mình!');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" khỏi hệ thống?`)) return;
    
    try {
      await api.delete(`/api/users/${userId}`);
      alert('Đã xóa nhân sự thành công!');
      await loadUsers();
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
        
        {/* CỘT TRÁI */}
        <div className="space-y-6 col-span-1">
          <AddCompanyForm onRefresh={fetchCompanies} />

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
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (e.target.value === 'admin') setNewCompanyId('');
                  }}
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
                    <option key={c.id} value={Number(c.id)}>{c.name}</option>
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

        {/* CỘT PHẢI */}
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
                  const isRoot = u.username === 'admin';
                  const isSelf = u.id === currentUser?.id;
                  const isAdminMode = u.role === 'admin';
                  
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-700 flex items-center gap-1">
                        {u.username}
                        {isRoot && <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1 rounded uppercase">Root</span>}
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={isRoot || isSelf}
                          className={`border rounded-lg p-1 text-[10px] font-black uppercase focus:outline-none transition-colors ${
                            u.role === 'admin' 
                              ? 'bg-amber-50 border-amber-200 text-amber-700' 
                              : u.role === 'ktt'
                              ? 'bg-purple-50 border-purple-200 text-purple-700'
                              : 'bg-slate-50 border-slate-200 text-blue-600'
                          } ${(isRoot || isSelf) ? 'cursor-not-allowed opacity-75' : ''}`}
                        >
                          <option value="admin">ADMIN</option>
                          <option value="ktt">KTT</option>
                          <option value="nv">NV</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select 
                          value={isAdminMode ? '' : (u.company_id ? Number(u.company_id) : '')} 
                          onChange={(e) => handleAssign(u.id, e.target.value)}
                          disabled={isAdminMode || isRoot}
                          className={`w-full border rounded-xl p-1.5 focus:outline-none text-slate-700 transition-colors ${
                            isAdminMode || isRoot
                              ? 'bg-amber-50 border-amber-200 font-bold text-amber-700 cursor-not-allowed' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <option value="">-- Để trống / Toàn quyền hệ thống --</option>
                          {companies.map(c => (
                            <option key={c.id} value={Number(c.id)}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1 min-h-[28px]">
                          {!isRoot && !isSelf && (
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
                                    } catch (err) { 
                                      alert(err.response?.data?.error || 'Lỗi reset mật khẩu'); 
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 rounded-xl hover:bg-amber-50 transition"
                                  title="Reset mật khẩu"
                                >
                                  <KeyRound size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <CompanyList companies={companies} onRefresh={fetchCompanies} />
    </div>
  );
}