import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ
const AuthContext = createContext(null);

// 2. Định nghĩa Component Provider
export function AuthProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')) || null);
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return sessionStorage.getItem('mustChangePassword') === 'true';
  });
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]); // <--- Thêm state quản lý danh sách nhân sự toàn cục

  // ĐỒNG BỘ CÔNG TY ACTIVE: Lưu trữ dưới dạng Object để Header hiển thị mượt mà, tránh lỗi đơ nút bấm
  const [activeCompany, setActiveCompany] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('activeCompany')) || null;
    } catch {
      return null;
    }
  });
  
  // ĐỒNG BỘ NIÊN ĐỘ: Tự động lấy từ localStorage, mặc định lấy 2026
  const [fiscalYear, setFiscalYearState] = useState(
    Number(localStorage.getItem('fiscalYear')) || 2026
  );

  const setFiscalYear = (year) => {
    setFiscalYearState(year);
    localStorage.setItem('fiscalYear', year);
  };

  // Hàm quét danh sách nhân sự dùng chung cho mọi cấu trúc màn hình
  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users');
      const data = res.data || [];
      setUsers(data);
      return data;
    } catch (err) {
      console.error('Lỗi tải danh sách nhân sự tại Context:', err);
      return [];
    }
  };

  useEffect(() => {
    if (token) {
      fetchCompanies();
      loadUsers(); // <--- Tự động tải danh sách nhân sự khi ứng dụng khởi chạy có token
    }
  }, [token]);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/api/companies');
      const listCompanies = res.data || [];
      setCompanies(listCompanies);
      
      // Đồng bộ hóa: Nếu có danh sách công ty mà chưa chọn công ty nào, hoặc công ty cũ không còn nằm trong danh sách được phân quyền
      if (listCompanies.length > 0) {
        const isExist = activeCompany ? listCompanies.some(c => c.id === activeCompany.id) : false;
        if (!activeCompany || !isExist) {
          const defaultComp = listCompanies[0];
          setActiveCompany(defaultComp);
          localStorage.setItem('activeCompany', JSON.stringify(defaultComp));
        }
      } else {
        setActiveCompany(null);
        localStorage.removeItem('activeCompany');
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách công ty:', err);
    }
  };

  const registerAdmin = async (username, password) => {
    try {
      const res = await api.post('/api/auth/register-admin', { username, password });
      return res.data;
    } catch (err) {
      throw err.response?.data?.error || err.message || 'Lỗi đăng ký hệ thống gốc';
    }
  };

  const login = async (username, password) => {
    try {
      const res = await api.post('/api/auth/login', { username, password });
      sessionStorage.setItem('token', res.data.token);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      sessionStorage.setItem('mustChangePassword', !!res.data.must_change_password ? 'true' : 'false');
      
      setToken(res.data.token);
      setUser(res.data.user);
      setMustChangePassword(!!res.data.must_change_password);
      
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      console.error('Lỗi gọi API logout hoặc token hết hạn trước đó:', e.message);
    } finally {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('mustChangePassword');
      localStorage.removeItem('activeCompany'); // Dọn dẹp cache công ty khi thoát
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
      setCompanies([]);
      setUsers([]); // Clear danh sách nhân sự
      setActiveCompany(null);
      setFiscalYearState(2026);
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    try {
      const res = await api.post('/api/auth/change-password', { oldPassword, newPassword });
      setMustChangePassword(false);
      sessionStorage.setItem('mustChangePassword', 'false');
      return res.data;
    } catch (err) {
      throw err.response?.data?.error || err.message || 'Lỗi đổi mật khẩu';
    }
  };

  // Thay đổi công ty active bằng Object (Khớp hoàn toàn với cơ chế của Header)
  const changeCompany = (companyObj) => {
    setActiveCompany(companyObj);
    localStorage.setItem('activeCompany', JSON.stringify(companyObj));
  };

  // HÀM ĐỒNG BỘ NÓNG: Cập nhật trực tiếp danh sách quyền mà không cần đăng xuất
  const updateUserCompanies = (newCompanyIds) => {
    if (user) {
      const updatedUser = { ...user, company_ids: newCompanyIds };
      setUser(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      setUser,
      users,             
      setUsers,          // <--- THÊM DÒNG NÀY VÀO ĐỂ CÁC COMPONENT CÓ QUYỀN SỬA STATE NGAY LẬP TỨC
      loadUsers,         
      updateUserCompanies,
      companies, 
      activeCompany, 
      setActiveCompany,
      fiscalYear,      
      setFiscalYear,   
      changeCompany, 
      login, 
      logout, 
      mustChangePassword,
      changePassword,
      registerAdmin, 
      fetchCompanies
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Khởi tạo Custom Hook nội bộ
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được lồng bên trong cấu trúc của AuthProvider');
  }
  return context;
}

export { useAuth };