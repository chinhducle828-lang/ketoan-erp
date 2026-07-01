import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import AddCompanyForm from './AddCompanyForm.jsx';
import CompanyList from './CompanyList.jsx';
import { ShieldAlert, Users, UserPlus, Trash2, KeyRound, Database } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

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
        if (Array.isArray(usersList)) {
          if (usersList.length > 0) {
            syncLocalUsers(usersList);
          } else if (usersList.length === 0 && localUsers.length === 0) {
            // DB rỗng thật sự (lần đầu mount, localUsers cũng rỗng)
            syncLocalUsers(usersList);
          }
        }
      } catch (err) {
        console.error('Lỗi khởi tạo CompanyManagement:', err);
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
      
      try {
        const refreshedUsers = await fetchUsersFromApi();
        if (refreshedUsers && refreshedUsers.length > 0) {
          syncLocalUsers(refreshedUsers);
        }
      } catch (err) {
        console.error('Lỗi refresh danh sách sau khi thêm nhân sự:', err);
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
    <div className="space-y-6 bg-slate-50/50 p-4 rounded-3xl min-h-screen">
      {/* TIÊU ĐỀ CHÍNH CHUẨN ERP */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
            <ShieldAlert className="text-emerald-600" size={24} />
            Cấu hình hệ thống và phân quyền doanh nghiệp
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">Quản trị phân vùng pháp nhân hạch toán độc lập và thiết lập sơ đồ nhân sự.</p>
        </div>
      </div>

      {/* BỐ CỤC GRID 12 CỘT TỐI ƯU CÂN ĐỐI */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* ================= CỘT TRÁI: FORM NHẬP LIỆU (4 CỘT) ================= */}
        <div className="space-y-6 xl:col-span-4">
          
          {/* FORM THÊM PHÁP NHÂN CÔNG TY */}
          <AddCompanyForm onRefresh={fetchCompanies} />

          {/* FORM KHAI BÁO NHÂN SỰ MỚI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <UserPlus size={16} className="text-emerald-600" /> Khai báo nhân sự mới
            </h3>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Tên tài khoản */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5 uppercase tracking-wider">Tên tài khoản</label>
                <input
                  type="text"
                  placeholder="Tên tài khoản nhân viên..."
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-400 italic pl-0.5">Viết liền không dấu, từ 3 ký tự trở lên (dùng đăng nhập).</p>
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5 uppercase tracking-wider">Mật khẩu ban đầu</label>
                <input
                  type="password"
                  placeholder="Mật khẩu ban đầu..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-400 italic pl-0.5">Mật khẩu khởi tạo, tối thiểu từ 6 ký tự bảo mật.</p>
              </div>

              {/* Vai trò */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5 uppercase tracking-wider">Vai trò hệ thống</label>
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
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-slate-700"
                >
                  <option value="nv">Nhân viên (nv)</option>
                  <option value="ktt">Kế toán trưởng (ktt)</option>
                  <option value="admin">Quản trị viên (admin)</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400 italic pl-0.5">Cấp hạn định chức năng nghiệp vụ.</p>
              </div>

              {/* Chọn đơn vị công tác */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5 uppercase tracking-wider">Cơ sở trực thuộc hạch toán</label>
                <div className="w-full text-xs border rounded-xl p-3 bg-slate-50 border-slate-200 space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Chọn một hoặc nhiều công ty liên kết
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {companies.map(c => (
                      <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 cursor-pointer text-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={newCompanyIds.includes(c.id)}
                          disabled={newRole === 'admin'}
                          onChange={() => toggleCompanySelection(c.id)}
                          className="h-3.5 w-3.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/20"
                        />
                        <span className="text-[11px] font-medium truncate" title={c.name}>{c.name}</span>
                      </label>
                    ))}
                    {companies.length === 0 && (
                      <div className="text-[11px] text-slate-400 leading-tight italic py-2">Chưa có công ty nào trên hệ thống.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Người quản lý trực tiếp (Chỉ hiển thị khi vai trò là 'nv') */}
              {newRole === 'nv' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 pl-0.5 uppercase tracking-wider">Cấp trên quản lý phụ trách</label>
                  <select
                    value={newManagerId}
                    onChange={(e) => setNewManagerId(e.target.value)}
                    className="w-full text-xs border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 bg-slate-50 border-slate-200 text-slate-700 font-medium"
                  >
                    <option value="">-- Chọn Kế toán trưởng quản lý --</option>
                    {localUsers.filter(u => u.role === 'ktt').map(ktt => (
                      <option key={ktt.id} value={ktt.id}>{ktt.username}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400 italic pl-0.5">Bắt buộc chỉ định KTT quản lý đối với cấp Nhân viên.</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full text-xs font-bold tracking-wider uppercase bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                + Tạo tài khoản nhân sự
              </button>
            </form>
          </div>
        </div>

        {/* ================= CỘT PHẢI: BẢNG BIỂU HIỂN THỊ & TOOLBAR TẬP TRUNG (8 CỘT) ================= */}
        <div className="xl:col-span-8 space-y-6">
          
          {/* THANH CÔNG CỤ (TOOLBAR) SAO LƯU & XUẤT NHẬP TẬP TRUNG */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">
            {/* Phân hệ sao lưu phục hồi dữ liệu gốc */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                <Database size={12} /> Backup JSON:
              </span>
              <select 
                value={exportCompanyId || ''} 
                onChange={e => setExportCompanyId(Number(e.target.value))} 
                className="text-xs p-1.5 border border-slate-200 rounded-lg bg-white max-w-[200px] truncate focus:outline-none text-slate-700 font-medium"
              >
                <option value="">-- Chọn công ty backup --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleExportCompany} className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors uppercase tracking-wide">
                Export
              </button>
              <label className="text-[11px] bg-slate-600 hover:bg-slate-700 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer transition-colors uppercase tracking-wide">
                {importing ? 'Importing...' : 'Import'}
                <input type="file" accept="application/json" onChange={e => handleImportFile(e.target.files?.[0])} className="hidden" />
              </label>
            </div>
            
            {/* Phân hệ xuất Excel báo cáo nhân sự */}
            <div className="flex items-center gap-2 w-full xl:w-auto justify-end border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Báo cáo excel nhân sự:</span>
              <ExportExcelButton endpoint="users" filename="Nhan_Su_He_Thong" label="Xuất Excel nhân sự" />
              <ImportExcelButton endpoint="users" filename="Nhan_Su_He_Thong" label="Nhập Excel danh sách" />
            </div>
          </div>

          {/* BẢNG CHÍNH: DANH SÁCH NGƯỜI DÙNG VÀ GÁN ĐƠN VỊ ĐỘNG */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={16} className="text-slate-500" /> Danh sách người dùng và gán đơn vị công tác
              </h3>
              {loadingUsers && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase animate-pulse tracking-wide">
                  Đang đồng bộ API...
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-4">Tên tài khoản</th>
                    <th className="p-3.5">Vai trò quyền</th>
                    <th className="p-3.5">Cơ sở làm việc được chỉ định (Khóa chiều rộng tên dài)</th>
                    <th className="p-3.5 text-center">Hành động nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localUsers.length > 0 ? (
                    localUsers.map(u => {
                      const isRoot = u.username === 'admin';
                      const isSelf = u.id === currentUser?.id;
                      const isAdminMode = u.role === 'admin';
                      
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                          {/* Tên User */}
                          <td className="p-3.5 pl-4 font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{u.username}</span>
                              {isRoot && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Root</span>}
                            </div>
                          </td>
                          {/* Vai trò Select */}
                          <td className="p-3.5">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={isRoot || isSelf}
                              className={`border rounded-lg px-2 py-1 text-[10px] font-black uppercase focus:outline-none transition-colors ${
                                u.role === 'admin' 
                                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                                  : u.role === 'ktt'
                                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                                  : 'bg-blue-50 border-slate-200 text-blue-600'
                              } ${(isRoot || isSelf) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                            >
                              <option value="admin">ADMIN</option>
                              <option value="ktt">KTT</option>
                              <option value="nv">NV</option>
                            </select>
                          </td>
                          {/* CƠ SỞ ĐƯỢC CHỈ ĐỊNH: ĐÃ KHÓA CHIỀU RỘNG CHỐNG BỊ PHÁ VỠ GIAO DIỆN KHI TÊN DÀI */}
                          <td className="p-3.5">
                            <select 
                              value={isAdminMode ? '' : (u.company_id ? Number(u.company_id) : '')} 
                              onChange={(e) => handleAssign(u.id, e.target.value)}
                              disabled={isAdminMode || isRoot}
                              className={`border rounded-xl p-2 focus:outline-none text-slate-700 text-xs font-medium transition-colors min-w-[260px] max-w-[420px] w-full truncate ${
                                isAdminMode || isRoot
                                  ? 'bg-amber-50/50 border-amber-100 font-bold text-amber-700/60 cursor-not-allowed' 
                                  : 'bg-slate-50 border-slate-200 cursor-pointer hover:border-slate-300'
                              }`}
                            >
                              <option value="">-- Để trống / Toàn quyền hệ thống --</option>
                              {companies.map(c => (
                                <option key={c.id} value={Number(c.id)} title={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* Khối nút Hành động */}
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1.5 min-h-[28px]">
                              {!isRoot && !isSelf && (
                                <>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                    title="Xóa nhân sự khỏi hệ thống"
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
                                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                                      title="Reset mật khẩu khẩn cấp"
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
                      <td colSpan="4" className="text-center py-8 text-slate-400 text-xs italic">
                        Chưa có dữ liệu nhân sự trực thuộc hệ thống.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* BẢNG PHỤ: THEO DÕI QUAN HỆ SƠ ĐỒ NHÂN SỰ PHÂN CẤP */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={16} className="text-slate-500" /> Bảng giám sát phân cấp nhân sự (KTT - NV)
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 pl-4">Tên tài khoản nhân sự</th>
                    <th className="p-3.5">Cấp bậc phân quyền</th>
                    <th className="p-3.5">Kế toán trưởng quản lý trực tiếp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localUsers.length > 0 ? (
                    localUsers.map(user => {
                      const managerName = user.manager_id
                        ? localUsers.find(u => u.id === user.manager_id)?.username || 'N/A'
                        : '—';
                      return (
                        <tr key={`monitor-${user.id}`} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-3.5 pl-4 font-bold text-slate-700">{user.username}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              user.role === 'admin'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : user.role === 'ktt'
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>
                              {user.role === 'admin' ? 'Admin' : user.role === 'ktt' ? 'KTT' : 'NV'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {user.role === 'nv' ? (
                              <span className="text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded-lg">👤 {managerName}</span>
                            ) : (
                              <span className="text-slate-300 italic pl-1">— Không áp dụng —</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-8 text-slate-400 text-xs italic">
                        Chưa có sơ đồ nhân sự để hiển thị.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* DANH SÁCH PHÁP NHÂN CÔNG TY NẰM PHÍA DƯỚI */}
      <CompanyList companies={companies} onRefresh={fetchCompanies} />
    </div>
  );
}