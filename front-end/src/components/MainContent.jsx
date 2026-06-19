import React, { Suspense, useState, useEffect } from 'react';
import { MODULES_REGISTER } from '../views/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { RefreshCw, AlertTriangle, Users, Save, CheckSquare } from 'lucide-react';
import ResponsiveContainer from './ResponsiveContainer.jsx';

export default function MainContent({ activeTab }) {
  const { activeCompany, token, user } = useAuth();

  // ==========================================
  // STATE & LOGIC PHỤC VỤ QUẢN LÝ Ô TÍCH CHỌN NHÂN SỰ (KHI ACTIVE_TAB = 'users')
  // ==========================================
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]); 
  const [selectedManagerId, setSelectedManagerId] = useState(''); 
  const [userMsg, setUserMsg] = useState('');

  // Tự động tải danh sách dữ liệu khi Admin mở tab quản lý nhân sự
  useEffect(() => {
    if (activeTab === 'users' && token && user?.role === 'admin') {
      fetchUsers();
      fetchCompanies();
    }
  }, [activeTab, token, user]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Lỗi lấy danh sách user:', err); }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/companies', {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Lỗi lấy danh sách công ty:', err); }
  };

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setUserMsg('');
    if (u.role === 'ktt') {
      setCheckedIds(u.staff_ids || []);
    } else if (u.role === 'nv') {
      setCheckedIds(u.company_ids || []);
      setSelectedManagerId(u.manager_id || '');
    }
  };

  const handleToggleCheckbox = (id) => {
    if (checkedIds.includes(id)) {
      setCheckedIds(checkedIds.filter(item => item !== id));
    } else {
      setCheckedIds([...checkedIds, id]);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    let url = '';
    let body = {};

    if (selectedUser.role === 'ktt') {
      url = 'http://localhost:5000/api/auth/assign-staff';
      body = { managerId: selectedUser.id, staffIds: checkedIds };
    } else {
      url = 'http://localhost:5000/api/auth/assign-company';
      body = {
        userId: selectedUser.id,
        companyIds: checkedIds,
        role: selectedUser.role,
        managerId: selectedManagerId ? Number(selectedManagerId) : null
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        setUserMsg('Cập nhật cấu hình phân quyền thành công!');
        fetchUsers(); 
      } else {
        setUserMsg(`Lỗi: ${data.error}`);
      }
    } catch (err) {
      setUserMsg(`Lỗi kết nối máy chủ: ${err.message}`);
    }
  };

  // ==========================================
  // LOGIC RENDER PHÂN HỆ HẠCH TOÁN THÔNG THƯỜNG
  // ==========================================
  
  // Trường hợp đặc biệt: Nếu là tab 'users' và là Admin -> Render trực tiếp giao diện cấu hình ô tích
  if (activeTab === 'users' && user?.role === 'admin') {
    return (
      <ResponsiveContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans animate-fade-in">
          
          {/* CỘT TRÁI: DANH SÁCH NHÂN SỰ */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <Users className="text-blue-600" size={20} />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Danh sách Nhân sự Hệ thống</h2>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {users.filter(u => u.role !== 'admin').map(u => (
                <div 
                  key={u.id} 
                  className={`p-3 border rounded-xl flex justify-between items-center transition-all ${selectedUser?.id === u.id ? 'bg-blue-50/60 border-blue-400 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}`}
                >
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{u.username}</p>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full ${u.role === 'ktt' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                      {u.role === 'ktt' ? 'Kế toán trưởng' : 'Nhân viên'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleSelectUser(u)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <CheckSquare size={14} />
                    Cấu hình ô tích
                  </button>
                </div>
              ))}
              {users.filter(u => u.role !== 'admin').length === 0 && (
                <p className="text-slate-400 text-xs text-center py-8">Chưa có nhân sự nào trực thuộc hệ thống.</p>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: KHU VỰC CẤU HÌNH Ô TÍCH CHỌN ĐỘNG */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            {selectedUser ? (
              <div className="flex flex-col h-full">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Phân quyền ô tích: <span className="text-blue-600 normal-case">{selectedUser.username}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedUser.role === 'ktt' ? 'Nhóm Kế toán trưởng $\rightarrow$ Tích chọn nhân viên quản lý' : 'Nhóm Kế toán viên $\rightarrow$ Tích chọn doanh nghiệp phân phối'}
                  </p>
                </div>

                {userMsg && (
                  <div className={`p-3 mb-4 text-xs font-bold rounded-xl border ${userMsg.startsWith('Lỗi') ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                    {userMsg}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[calc(100vh-280px)]">
                  {/* GIAO DIỆN KẾ TOÁN TRƯỞNG */}
                  {selectedUser.role === 'ktt' && (
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
                        Tích chọn nhân viên cấp dưới trực thuộc (Tối đa 15 người):
                      </label>
                      <div className="border border-slate-100 p-2 rounded-xl bg-slate-50/50 space-y-1">
                        {users.filter(u => u.role === 'nv').map(staff => (
                          <label key={staff.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white cursor-pointer text-xs font-medium text-slate-700 transition-all">
                            <input
                              type="checkbox"
                              checked={checkedIds.includes(staff.id)}
                              onChange={() => handleToggleCheckbox(staff.id)}
                              className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>{staff.username}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GIAO DIỆN NHÂN VIÊN */}
                  {selectedUser.role === 'nv' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Chỉ định Kế toán trưởng phụ trách trực tiếp:</label>
                        <select
                          value={selectedManagerId}
                          onChange={(e) => setSelectedManagerId(e.target.value)}
                          className="w-full border border-slate-200 p-2.5 rounded-xl text-xs font-medium bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-700"
                        >
                          <option value="">-- Để trống độc lập (Không thuộc nhóm nào) --</option>
                          {users.filter(u => u.role === 'ktt').map(m => (
                            <option key={m.id} value={m.id}>{m.username}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Tích chọn các công ty được quyền ghi sổ hạch toán:</label>
                        <div className="border border-slate-100 p-2 rounded-xl bg-slate-50/50 space-y-1">
                          {companies.map(comp => (
                            <label key={comp.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-all border border-transparent hover:border-slate-200/60">
                              <input
                                type="checkbox"
                                checked={checkedIds.includes(comp.id)}
                                onChange={() => handleToggleCheckbox(comp.id)}
                                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="text-xs">
                                <p className="font-bold text-slate-700">{comp.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">MST: {comp.tax_code || 'N/A'}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSavePermissions}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Save size={14} />
                  Lưu cấu hình ô tích
                </button>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6">
                <CheckSquare size={28} className="text-slate-300 mb-2" />
                <p className="text-xs font-medium max-w-xs leading-relaxed">Vui lòng bấm nút "Cấu hình ô tích" tại một nhân sự bên trái để thực hiện phân quyền hàng loạt.</p>
              </div>
            )}
          </div>

        </div>
      </ResponsiveContainer>
    );
  }

  // Luồng xử lý phân hệ hạch toán thông thường
  const currentModule = MODULES_REGISTER.find(m => m.id === activeTab);

  if (!currentModule) {
    return <div className="p-4 text-xs text-rose-600">Phân hệ không hợp lệ.</div>;
  }

  if (currentModule.requiresActiveCompany && !activeCompany) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-lg mx-auto mt-12 animate-fade-in">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mb-4 border border-amber-100">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Chưa chọn pháp nhân hạch toán</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          Vui lòng chọn doanh nghiệp cần ghi sổ, hạch toán báo cáo ở thanh công cụ phía trên đỉnh màn hình để mở khóa dữ liệu phân hệ này.
        </p>
      </div>
    );
  }

  const LazyComponent = currentModule.component;

  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <RefreshCw className="animate-spin text-emerald-600" size={16} />
        <span>Đang nạp dữ liệu phân hệ hạch toán...</span>
      </div>
    }>
      <ResponsiveContainer>
        <LazyComponent />
      </ResponsiveContainer>
    </Suspense>
  );
}