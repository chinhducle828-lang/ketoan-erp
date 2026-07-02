import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// ĐÃ SỬA: Import thêm hàm setRAMToken để nạp mã token trực tiếp vào bộ nhớ RAM
import api, { setRAMToken } from '../utils/api.js'; 

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // ĐÃ SỬA: State token chỉ quản lý trạng thái local, KHÔNG đọc từ localStorage nữa
  const [token, setToken] = useState(null);
  
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return localStorage.getItem('mustChangePassword') === 'true';
  });
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]); 

  const [activeCompany, setActiveCompany] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('activeCompany')) || null;
    } catch {
      return null;
    }
  });
  
  const [fiscalYear, setFiscalYearState] = useState(
    Number(localStorage.getItem('fiscalYear')) || 2026
  );
  
  const [hasOpeningBalance, setHasOpeningBalance] = useState(false);
  const [openingBalanceMessage, setOpeningBalanceMessage] = useState('');

  const savePreferencesToServer = useCallback(async (prefs) => {
    if (!token) return;
    try {
      await api.put('/api/auth/preferences', prefs);
    } catch (err) {
      console.warn('Không thể đồng bộ preferences lên server:', err.message);
    }
  }, [token]);

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
    savePreferencesToServer({ fiscalYear: year });
  };

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

  // Vòng lặp tự động làm mới phiên làm việc (Silent Refresh) bằng HttpOnly Cookie
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const res = await api.post('/api/auth/refresh', null, { withCredentials: true });
        const accessToken = res.data.accessToken;
        if (accessToken) {
          // ĐÃ SỬA: Nạp vào RAM của Axios interceptor và gán State
          setRAMToken(accessToken);
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

    // Khởi tạo chạy ngầm: Nếu chưa có Token trên RAM, ép chạy silentRefresh để lấy từ Cookie
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

      // ĐÃ SỬA: Đẩy token vào RAM, loại bỏ localStorage.setItem('token') bẩn
      setRAMToken(accessToken);
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
      // ĐÃ SỬA: Giải phóng RAM token, xóa triệt để session cũ
      setRAMToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('mustChangePassword');
      localStorage.removeItem('activeCompany'); 
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
      setCompanies([]);
      setUsers([]); 
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

  const changeCompany = (companyObj) => {
    setActiveCompany(companyObj);
    localStorage.setItem('activeCompany', JSON.stringify(companyObj));
  };

  const updateUserCompanies = (newCompanyIds) => {
    if (user) {
      const updatedUser = { ...user, company_ids: newCompanyIds };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

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
      setUsers,          
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

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được lồng bên trong cấu trúc của AuthProvider');
  }
  return context;
}

export { useAuth };