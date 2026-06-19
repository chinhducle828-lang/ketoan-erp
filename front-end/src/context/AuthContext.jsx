import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ
const AuthContext = createContext(null);

// 2. Định nghĩa Component Provider
export function AuthProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')) || null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(Number(localStorage.getItem('activeCompany')) || null);
  
  // ĐỒNG BỘ NIÊN ĐỘ: Tự động lấy từ localStorage, mặc định lấy 2026
  const [fiscalYear, setFiscalYearState] = useState(
    Number(localStorage.getItem('fiscalYear')) || 2026
  );

  const setFiscalYear = (year) => {
    setFiscalYearState(year);
    localStorage.setItem('fiscalYear', year);
  };

  useEffect(() => {
    if (token) {
      fetchCompanies();
    }
  }, [token]);

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/api/companies');
      setCompanies(res.data);
      if (res.data.length > 0 && !activeCompany) {
        const defaultId = user?.company_id || res.data[0].id;
        setActiveCompany(defaultId);
        localStorage.setItem('activeCompany', defaultId);
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
      setToken(res.data.token);
      setUser(res.data.user);
      setMustChangePassword(!!res.data.must_change_password);
      
      if (res.data.user.company_id) {
        setActiveCompany(res.data.user.company_id);
        localStorage.setItem('activeCompany', res.data.user.company_id);
      }
      return res.data;
    } catch (err) {
      // Ép trả lỗi thô ra để Frontend bắt được thay vì crash ngầm
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
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
      setCompanies([]);
      setActiveCompany(null);
      setFiscalYearState(2026);
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    try {
      const res = await api.post('/api/auth/change-password', { oldPassword, newPassword });
      setMustChangePassword(false);
      return res.data;
    } catch (err) {
      throw err.response?.data?.error || err.message || 'Lỗi đổi mật khẩu';
    }
  };

  const changeCompany = (id) => {
    setActiveCompany(id);
    localStorage.setItem('activeCompany', id);
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      companies, 
      activeCompany, 
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