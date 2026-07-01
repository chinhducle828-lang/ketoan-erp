import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AddCompanyForm from './AddCompanyForm.jsx';
import CompanyList from './CompanyList.jsx';
import { ShieldAlert, Users, UserPlus, Trash2, KeyRound } from 'lucide-react';

export default function CompanyManagement() {
  // Lấy danh sách dữ liệu và hàm load từ Context chung của hệ thống
  const { fetchCompanies, companies, user: currentUser, loadUsers } = useAuth();

  const [localUsers, setLocalUsers] = useState(() => {
    // Khôi phục danh sách từ localStorage để không mất dữ liệu khi F5
    try {
      const saved = localStorage.getItem('companyManagement_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const initialFetchDone = useRef(false);

  // Lưu localUsers vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('companyManagement_users', JSON.stringify(localUsers));
    } catch (e) {
      console.error('Không thể lưu danh sách nhân sự vào localStorage:', e);
    }
  }, [localUsers]);

  const syncLocalUsers = useCallback((userList) => {
    const mapped = Array.isArray(userList) ? userList.map(user => ({
      ...user,
      company_id: Array.isArray(user.company_ids) ? (user.company_ids[0] || null) : null
    })) : [];
    setLocalUsers(mapped);
    // Lưu ngay vào localStorage
    try {
      localStorage.setItem('companyManagement_users', JSON.stringify(mapped));
    } catch (e) {
      console.error('Không thể lưu danh sách nhân sự vào localStorage:', e);
    }
  }, []);

  // Use centralized loader from AuthContext to avoid divergent user state
  const fetchUsersFromApi = async () => {
    try {
      const data = await loadUsers();
      return Array.isArray(data) ? data : null; // null = lỗi, không sync
    } catch (err) {
      console.error('Lỗi tải danh sách nhân sự từ Context:', err);
      return null; // null = lỗi, không sync
    }
  };

  useEffect(() => {
    // Chỉ chạy 1 lần khi component mount để tránh vòng lặp vô hạn
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    const init = async () => {
      setLoadingUsers(true);
      try {
        const [companiesList, usersList] = await Promise.all([
          fetchCompanies().catch((err) => {
            console.error('Lỗi tải danh sách công ty:', err);
            return [];
          }),
          fetchUsersFromApi()
        ]);
        // Chỉ sync khi có dữ liệu thật từ API (không null, không [] rỗng do lỗi)
        // Khi API lỗi trả về null => giữ nguyên localUsers (mảng rỗng ban đầu hoặc dữ liệu cũ)
        if (Array.isArray(usersList)) {
          if (usersList.length > 0) {
            syncLocalUsers(usersList);
          } else if (usersList.length === 0 && localUsers.length === 0) {
            // DB rỗng thật sự (lần đầu mount, localUsers cũng rỗng)
            syncLocalUsers(usersList);
          }
          // Nếu usersList rỗng nhưng localUsers đã có dữ liệu => API lỗi => giữ nguyên
        }
        // Nếu usersList là null => API lỗi => giữ nguyên localUsers
      } catch (err) {
        console.error('Lỗi khởi tạo CompanyManagement:', err);
        // Không syncLocalUsers([]) ở đây vì sẽ làm mất dữ liệu hiện có
      } finally {
        setLoadingUsers(false);
        if (companies && companies.length > 0 && exportCompanyId == null) setExportCompanyId(companies[0].id);
      }
    };

    init();
  }, []);

  // States quản lý Form thêm nhân viên mới
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('nv');
  const [newManagerId, setNewManagerId] = useState('');
  const [newCompanyIds, setNewCompanyIds] = useState([]);
  const [exportCompanyId, setExportCompanyId] = useState(null);
  const [importing, setImporting] = useState(false);

  const toggleCompanySelection = (companyId) => {
    setNewCompanyIds(prev => {
      if (prev.includes(companyId)) {
        return prev.filter(id => id !== companyId);
      }
      return [...prev, companyId];
    });
  };

  // Thay đổi đơn vị công tác trực tiếp trên bảng
  const handleAssign = async (userId, companyId) => {
    const targetCompanyId = companyId ? Number(companyId) : null;
    const targetUser = localUsers.find(u => u.id === userId);

    if (targetUser?.username === 'admin') {
      alert('Không thể cấu hình đơn vị công tác cho tài khoản Root!');
      return;
    }

    setLocalUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, company_id: targetCompanyId } : u
    ));

    try {
      await api.post('/api/auth/assign-company', {
        userId,
        companyId: targetCompanyId,
        companyIds: targetCompanyId ? [targetCompanyId] : [],
        role: targetUser?.role || 'nv'
      });
      const updatedUsers = await fetchUsersFromApi();
      syncLocalUsers(updatedUsers);
    } catch (err) {
      alert('Lỗi gán quyền đơn vị');
      const updatedUsers = await fetchUsersFromApi();
      syncLocalUsers(updatedUsers);
    }
  };

  // Thay đổi Vai trò trực tiếp trên bảng
  const handleRoleChange = async (userId, newRole) => {
    const targetUser = localUsers.find(u => u.id === userId);

    if (targetUser?.username === 'admin') {
      alert('Cấm tuyệt đối hành vi tương tác hoặc thay đổi vai trò của tài khoản Root hệ thống!');
      return;
    }

    if (userId === currentUser?.id) {
      alert('Bạn không thể tự thay đổi vai trò của chính mình!');
      return;
    }

    setLocalUsers(prev => prev.map(u =>
      u.id === userId ? {
        ...u,
        role: newRole,
        company_id: newRole === 'admin' ? null : u.company_id
      } : u
    ));

    try {
      await api.post('/api/auth/assign-company', {
        userId,
        companyId: newRole === 'admin' ? null : (targetUser?.company_id || null),
        companyIds: newRole === 'admin' ? [] : (targetUser?.company_id ? [targetUser.company_id] : []),
        role: newRole
      });
      const updatedUsers = await fetchUsersFromApi();
      syncLocalUsers(updatedUsers);
    } catch (err) {
      alert('Lỗi cập nhật vai trò');
      const updatedUsers = await fetchUsersFromApi();
      syncLocalUsers(updatedUsers);
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
      const companyIdsPayload = newRole === 'admin' ? [] : newCompanyIds.map(Number).filter(id => id > 0);
      const res = await api.post('/api/users', {
        username: newUsername,
        password: newPassword,
        role: newRole,
        companyIds: companyIdsPayload,
        managerId: newRole === 'nv' ? (newManagerId ? Number(newManagerId) : null) : null
      });

      const createdUser = res.data?.user;
      if (createdUser) {
        // Thêm ngay vào localUsers để UI cập nhật tức thì
        setLocalUsers(prev => [
          ...prev,
          {
            ...createdUser,
            company_ids: companyIdsPayload,
            company_id: companyIdsPayload[0] || null,
            manager_id: newRole === 'nv' ? (newManagerId ? Number(newManagerId) : null) : null
          }
        ]);
      }

      alert('Thêm nhân sự mới thành công!');
      setNewUsername('');
      setNewPassword('');
      setNewCompanyIds([]);
      setNewManagerId('');
      setNewRole('nv');
      
      // Refresh từ API để đồng bộ với dữ liệu server
      // Chỉ ghi đè nếu refresh thành công (có dữ liệu), tránh mất danh sách khi API lỗi
      try {
        const refreshedUsers = await fetchUsersFromApi();
        if (refreshedUsers && refreshedUsers.length > 0) {
          syncLocalUsers(refreshedUsers);
        }
      } catch (err) {
        console.error('Lỗi refresh danh sách sau khi thêm nhân sự:', err);
        // Giữ nguyên localUsers từ optimistic update
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi thêm nhân sự mới!');
    }
  };

  // Export company data as JSON file
  const handleExportCompany = async () => {
    try {
      const id = exportCompanyId || (companies[0] && companies[0].id);
      if (!id) return alert('Vui lòng chọn công ty để xuất dữ liệu.');
      const res = await api.get(`/api/companies/${id}/export`);
      const dataStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `company_${id}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xuất dữ liệu công ty');
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const id = exportCompanyId || (companies[0] && companies[0].id);
    if (!id) return alert('Vui lòng chọn công ty để nhập dữ liệu.');
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.post(`/api/companies/${id}/import`, payload);
      if (res.data && res.data.success) {
        alert('Nhập dữ liệu thành công.');
        fetchCompanies();
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Lỗi khi nhập dữ liệu');
    } finally {
      setImporting(false);
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
      const refreshedUsers = await fetchUsersFromApi();
      syncLocalUsers(refreshedUsers);
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

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 justify-between">
              <div className="text-xs font-bold text-slate-500">Sao lưu / Phục hồi dữ liệu công ty</div>
              <div className="flex items-center gap-2">
                <select value={exportCompanyId || ''} onChange={e => setExportCompanyId(Number(e.target.value))} className="text-xs p-2 border rounded-lg bg-white">
                  <option value="">-- Chọn công ty --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={handleExportCompany} className="text-xs bg-amber-600 text-white px-2 py-1 rounded-lg">Export</button>
                <label className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg cursor-pointer">
                  {importing ? 'Đang nhập...' : 'Import'}
                  <input type="file" accept="application/json" onChange={e => handleImportFile(e.target.files?.[0])} className="hidden" />
                </label>
              </div>
            </div>
          </div>

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
                    const selectedRole = e.target.value;
                    setNewRole(selectedRole);
                    if (selectedRole === 'admin') {
                      setNewCompanyIds([]);
                      setNewManagerId('');
                    }
                    if (selectedRole === 'ktt') {
                      setNewManagerId('');
                    }
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none"
                >
                  <option value="nv">Nhân viên (nv)</option>
                  <option value="ktt">Kế toán trưởng (ktt)</option>
                  <option value="admin">Quản trị viên (admin)</option>
                </select>

                <div className="w-full text-xs border rounded-xl p-3 bg-slate-50 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Chọn một hoặc nhiều công ty
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                    {companies.map(c => (
                      <label key={c.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={newCompanyIds.includes(c.id)}
                          disabled={newRole === 'admin'}
                          onChange={() => toggleCompanySelection(c.id)}
                          className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
                        />
                        <span className="text-[11px] font-medium">{c.name}</span>
                      </label>
                    ))}
                    {companies.length === 0 && (
                      <div className="text-[11px] text-slate-400">Chưa có công ty nào. Vui lòng thêm công ty trước.</div>
                    )}
                  </div>
                </div>
              </div>
              {newRole === 'nv' && (
                <div>
                  <select
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                    className="w-full text-xs border rounded-xl p-2.5 focus:outline-none bg-slate-50 border-slate-200"
                  >
                    <option value="">-- Chọn Kế toán trưởng quản lý --</option>
                    {localUsers.filter(u => u.role === 'ktt').map(ktt => (
                      <option key={ktt.id} value={ktt.id}>{ktt.username}</option>
                    ))}
                  </select>
                </div>
              )}

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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={16} /> Danh sách người dùng và gán đơn vị công tác
            </h3>
            {loadingUsers && (
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Đang tải dữ liệu...</span>
            )}
          </div>
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
                {/* DÙNG localUsers THAY VÌ users Ở ĐÂY ĐỂ UI KHÔNG BỊ TRƯỢT */}
                {localUsers.length > 0 ? (
                  localUsers.map(u => {
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
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400 text-xs">
                      Chưa có nhân sự nào trực thuộc hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* KHỐI HIỂN THỊ DANH SÁCH NHÂN SỰ HỆ THỐNG ĐÃ ĐƯỢC ĐỒNG BỘ ĐỘNG */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users size={16} /> Danh sách nhân sự hệ thống
        </h3>
        
        {localUsers.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            Chưa có nhân sự nào trực thuộc hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <th className="p-3">Tên tài khoản</th>
                  <th className="p-3">Vai trò</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* DÙNG localUsers THAY VÌ users Ở ĐÂY */}
                {localUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-bold text-slate-700">{user.username}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-black uppercase text-[10px]">
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompanyList companies={companies} onRefresh={fetchCompanies} />
    </div>
  );
}