import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import ChangePassword from './views/auth/ChangePassword.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import MainContent from './components/MainContent.jsx';

export default function App() {
  const { token, user, mustChangePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('opening');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // ==========================================
  // STATE & LOGIC PHỤC VỤ QUẢN LÝ Ô TÍCH CHỌN NHÂN SỰ
  // ==========================================
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]); // Lưu mảng ID ô được tích chọn hàng loạt
  const [selectedManagerId, setSelectedManagerId] = useState(''); // ID Kế toán trưởng phụ trách
  const [userMsg, setUserMsg] = useState('');

  // Tự động tải danh sách dữ liệu khi Admin đăng nhập thành công
  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchUsers();
      fetchCompanies();
    }
  }, [token, user]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Lỗi lấy danh sách user:', err); }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/companies', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) { console.error('Lỗi lấy danh sách công ty:', err); }
  };

  // Kích hoạt khi Admin click chọn cấu hình một người dùng
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

  // Thao tác Bật/Tắt ô tích chọn (Checkbox)
  const handleToggleCheckbox = (id) => {
    if (checkedIds.includes(id)) {
      setCheckedIds(checkedIds.filter(item => item !== id));
    } else {
      setCheckedIds([...checkedIds, id]);
    }
  };

  // Gửi mảng ô tích lên Backend để lưu trữ
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
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        setUserMsg('Cập nhật cấu hình phân quyền thành công!');
        fetchUsers(); // Tải lại dữ liệu mới để đồng bộ trạng thái ô tick
      } else {
        setUserMsg(`Lỗi: ${data.error}`);
      }
    } catch (err) {
      setUserMsg(`Lỗi kết nối máy chủ: ${err.message}`);
    }
  };

  // ==========================================
  // ĐIỀU HƯỚNG LOGIN / CHƯA XÁC THỰC
  // ==========================================
  if (!token) {
    if (isFirstRun) {
      return <Register onSwitch={() => setIsFirstRun(false)} />;
    }
    return <Login onFirstRun={() => setIsFirstRun(true)} />;
  }

  if (token && mustChangePassword) {
    return <ChangePassword />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileSidebarOpen}
        onRequestClose={() => setMobileSidebarOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileSidebarOpen(open => !open)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* NẾU LÀ TAB QUẢN LÝ NHÂN SỰ ('users'): HIỂN THỊ GIAO DIỆN Ô TÍCH CHỌN THÔNG MINH */}
          {activeTab === 'users' && user?.role === 'admin' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
              
              {/* CỘT TRÁI: BẢNG DANH SÁCH NHÂN SỰ */}
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Danh sách Nhân sự Hệ thống</h2>
                <div className="space-y-2">
                  {users.filter(u => u.role !== 'admin').map(u => (
                    <div 
                      key={u.id} 
                      className={`p-3 border rounded-lg flex justify-between items-center transition-all ${selectedUser?.id === u.id ? 'bg-blue-50/70 border-blue-400' : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'}`}
                    >
                      <div>
                        <p className="font-semibold text-gray-700">{u.username}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xxs font-semibold rounded-full ${u.role === 'ktt' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {u.role === 'ktt' ? 'Kế toán trưởng' : 'Nhân viên'}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleSelectUser(u)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-sm transition-all"
                      >
                        Cấu hình ô tích
                      </button>
                    </div>
                  ))}
                  {users.filter(u => u.role !== 'admin').length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-6">Chưa có nhân sự nào được tạo.</p>
                  )}
                </div>
              </div>

              {/* CỘT PHẢI: KHU VỰC TÍCH Ô ĐỘNG THEO VAI TRÒ */}
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                {selectedUser ? (
                  <div>
                    <h3 className="text-base font-bold text-gray-800 mb-1">
                      Phân quyền ô tích: <span className="text-blue-600">{selectedUser.username}</span>
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      {selectedUser.role === 'ktt' ? 'Quyền: Kế toán trưởng (Tích chọn nhân viên dưới quyền)' : 'Quyền: Kế toán viên (Chọn KTT quản lý và tích chọn doanh nghiệp)'}
                    </p>

                    {userMsg && (
                      <div className={`p-2.5 mb-4 text-xs font-semibold rounded-md border ${userMsg.startsWith('Lỗi') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                        {userMsg}
                      </div>
                    )}

                    {/* GIAO DIỆN DÀNH CHO KẾ TOÁN TRƯỞNG */}
                    {selectedUser.role === 'ktt' && (
                      <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 mb-2">
                          Tích chọn các nhân viên thuộc nhóm quản lý (Tối đa 15 người):
                        </label>
                        <div className="border border-gray-200 p-2 rounded-lg bg-gray-50 max-h-64 overflow-y-auto space-y-1.5">
                          {users.filter(u => u.role === 'nv').map(staff => (
                            <label key={staff.id} className="flex items-center space-x-3 p-2 rounded hover:bg-white cursor-pointer text-sm text-gray-700 transition-all">
                              <input
                                type="checkbox"
                                checked={checkedIds.includes(staff.id)}
                                onChange={() => handleToggleCheckbox(staff.id)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="font-medium">{staff.username}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* GIAO DIỆN DÀNH CHO NHÂN VIÊN */}
                    {selectedUser.role === 'nv' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1.5">Chỉ định Kế toán trưởng phụ trách trực tiếp:</label>
                          <select
                            value={selectedManagerId}
                            onChange={(e) => setSelectedManagerId(e.target.value)}
                            className="w-full border border-gray-200 p-2 rounded-lg text-sm bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                          >
                            <option value="">-- Chưa thuộc nhóm nào (Để trống) --</option>
                            {users.filter(u => u.role === 'ktt').map(m => (
                              <option key={m.id} value={m.id}>{m.username}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-2">Tích chọn chuỗi doanh nghiệp nhân viên được phép hạch toán:</label>
                          <div className="border border-gray-200 p-2 rounded-lg bg-gray-50 max-h-64 overflow-y-auto space-y-1.5">
                            {companies.map(comp => (
                              <label key={comp.id} className="flex items-center space-x-3 p-2 rounded hover:bg-white cursor-pointer transition-all border border-transparent hover:border-gray-100">
                                <input
                                  type="checkbox"
                                  checked={checkedIds.includes(comp.id)}
                                  onChange={() => handleToggleCheckbox(comp.id)}
                                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="text-sm">
                                  <p className="font-semibold text-gray-700">{comp.name}</p>
                                  <p className="text-xxs text-gray-400">MST: {comp.tax_code || 'Chưa khai báo'}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleSavePermissions}
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-sm shadow-sm transition-all"
                    >
                      Lưu cấu hình ô tích
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                    <p className="text-xs">Vui lòng chọn một nhân sự từ danh sách bên trái để thực hiện cấu hình tích chọn ô.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* ĐỐI VỚI CÁC TAB KHÁC (opening, vouchers, v.v.): GIỮ NGUYÊN HOẠT ĐỘNG CỦA MAINCONTENT */
            <MainContent activeTab={activeTab} />
          )}

        </main>
      </div>
    </div>
  );
}