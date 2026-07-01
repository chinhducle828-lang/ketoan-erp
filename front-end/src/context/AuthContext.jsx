import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ
const AuthContext = createContext(null);

// 2. Định nghĩa Component Provider
export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return localStorage.getItem('mustChangePassword') === 'true';
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
  
  // Trạng thái kiểm tra số dư đầu kỳ
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [openingBalanceMessage, setOpeningBalanceMessage] = useState('');

  // Hàm lưu preferences lên server (activeCompany, fiscalYear)
  const savePreferencesToServer = useCallback(async (prefs) => {
    if (!token) return;
    try {
      await api.put('/api/auth/preferences', prefs);
    } catch (err) {
      console.warn('Không thể đồng bộ preferences lên server:', err.message);
    }
  }, [token]);

  // Hàm tải preferences từ server sau khi đăng nhập
  const loadPreferencesFromServer = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/api/auth/preferences');
      const prefs = res.data || {};
      if (prefs.fiscalYear) {
        setFiscalYearState(Number(prefs.fiscalYear));
        localStorage.setItem('fiscalYear', String(prefs.fiscalYear));
      }
      return prefs;
    } catch (err) {
      console.warn('Không thể tải preferences từ server:', err.message);
      return {};
    }
  }, [token]);

  const setFiscalYear = (year) => {
    setFiscalYearState(year);
    localStorage.setItem('fiscalYear', year);
    // Đồng bộ lên server để dùng được ở máy khác
    savePreferencesToServer({ fiscalYear: year });
  };

  // Hàm quét danh sách nhân sự dùng chung cho mọi cấu trúc màn hình
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      const data = res.data || [];
      setUsers(data);
      return data;
    } catch (err) {
      console.error('Lỗi tải danh sách nhân sự tại Context:', err);
      return [];
    }
  }, [token]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/api/companies');
      const listCompanies = res.data || [];
      setCompanies(listCompanies);

      // Use functional update to avoid creating a changing dependency on `activeCompany`
      setActiveCompany(prev => {
        if (!Array.isArray(listCompanies) || listCompanies.length === 0) {
          localStorage.removeItem('activeCompany');
          return null;
        }

        const exists = prev ? listCompanies.some(c => c.id === prev.id) : false;
        if (!prev || !exists) {
          const defaultComp = listCompanies[0];
          localStorage.setItem('activeCompany', JSON.stringify(defaultComp));
          return defaultComp;
        }
        return prev;
      });
    } catch (err) {
      console.error('Lỗi lấy danh sách công ty:', err);
    }
  }, [token]);

  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const res = await api.post('/api/auth/refresh', null, { withCredentials: true });
        const accessToken = res.data.accessToken;
        if (accessToken) {
          localStorage.setItem('token', accessToken);
          setToken(accessToken);
        }
        if (res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
        if (res.data.must_change_password !== undefined) {
          setMustChangePassword(!!res.data.must_change_password);
          localStorage.setItem('mustChangePassword', !!res.data.must_change_password ? 'true' : 'false');
        }
        await Promise.all([fetchCompanies(), loadUsers(), loadPreferencesFromServer()]);
      } catch (err) {
        console.warn('Không thể làm mới phiên tự động:', err.message || err);
      }
    };

    if (token) {
      fetchCompanies().catch(() => {});
      loadUsers().catch(() => {});
      loadPreferencesFromServer().catch(() => {});
    } else {
      silentRefresh();
    }
  }, [token, fetchCompanies, loadUsers, loadPreferencesFromServer]);

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
      const accessToken = res.data.accessToken || res.data.token;
      if (!accessToken) {
        throw new Error('Không nhận được access token từ server.');
      }

      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem('mustChangePassword', !!res.data.must_change_password ? 'true' : 'false');

      setToken(accessToken);
      setUser(res.data.user);
      setMustChangePassword(!!res.data.must_change_password);

      await Promise.all([fetchCompanies(), loadUsers(), loadPreferencesFromServer()]);
      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', null, { withCredentials: true });
    } catch (e) {
      console.error('Lỗi gọi API logout hoặc token hết hạn trước đó:', e.message);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('mustChangePassword');
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
      localStorage.setItem('mustChangePassword', 'false');
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
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  // Kiểm tra trạng thái số dư đầu kỳ của công ty đang chọn
  const checkOpeningBalanceStatus = useCallback(async (companyId) => {
    if (!companyId) {
      setHasOpeningBalance(false);
      setOpeningBalanceMessage('');
      return;
    }
    try {
      const res = await api.get(`/api/opening-balances/status?company_id=${companyId}`);
      setHasOpeningBalance(res.data.hasOpeningBalance || false);
      setOpeningBalanceMessage(res.data.message || '');
    } catch (err) {
      console.error('Lỗi kiểm tra số dư đầu kỳ:', err);
      setHasOpeningBalance(false);
      setOpeningBalanceMessage('');
    }
  }, [token]);

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
      fetchCompanies,
      hasOpeningBalance,
      openingBalanceMessage,
      checkOpeningBalanceStatus
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