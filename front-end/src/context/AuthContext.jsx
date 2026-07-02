import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Import thêm hàm setRAMToken và đối tượng api cấu hình tập trung
import api, { setRAMToken } from '../utils/api.js'; 

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // Thêm trạng thái chờ khởi tạo token ban đầu
  
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
    if (!inMemoryTokenActive()) return; // Kiểm tra nhanh trạng thái token trước khi gọi
    try {
      await api.put('/api/auth/preferences', prefs);
    } catch (err) {
      console.warn('Không thể đồng bộ preferences lên server:', err.message);
    }
  }, []);

  const loadPreferencesFromServer = useCallback(async () => {
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
  }, []);

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
  }, []);

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
  }, []);

  // Hàm tiện ích nội bộ để kiểm tra nhanh trạng thái
  const inMemoryTokenActive = () => !!token;

  // 🔄 EFFECT 1: Chạy DUY NHẤT 1 lần khi ứng dụng khởi chạy (F5/Reload) để nạp lại token từ Cookie ngầm
  useEffect(() => {
    const initSilentRefresh = async () => {
      try {
        const res = await api.post('/api/auth/refresh', null, { withCredentials: true });
        const accessToken = res.data?.accessToken || res.data?.data?.accessToken;
        
        if (accessToken) {
          setRAMToken(accessToken);
          setToken(accessToken);
          
          if (res.data.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
          if (res.data.must_change_password !== undefined) {
            setMustChangePassword(!!res.data.must_change_password);
            localStorage.setItem('mustChangePassword', !!res.data.must_change_password ? 'true' : 'false');
          }
        }
      } catch (err) {
        console.log('Chưa đăng nhập hoặc phiên làm việc cũ đã hết hạn.');
      } finally {
        setLoading(false); // Hoàn tất quá trình quét xác thực ban đầu
      }
    };

    initSilentRefresh();
  }, []);

  // 📦 EFFECT 2: Tự động đồng bộ kéo dữ liệu danh mục khi Token hợp lệ được kích hoạt
  useEffect(() => {
    if (!token) return;

    fetchCompanies();
    loadUsers();
    loadPreferencesFromServer();
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
      const accessToken = res.data?.accessToken || res.data?.token || res.data?.data?.accessToken;
      if (!accessToken) {
        throw new Error('Không nhận được access token từ server.');
      }

      setRAMToken(accessToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem('mustChangePassword', !!res.data.must_change_password ? 'true' : 'false');

      setToken(accessToken);
      setUser(res.data.user);
      setMustChangePassword(!!res.data.must_change_password);

      return res.data;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout', null, { withCredentials: true });
    } catch (e) {
      console.error('Lỗi gọi API logout:', e.message);
    } finally {
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
      setHasOpeningBalance(res.data?.hasOpeningBalance || false);
      setOpeningBalanceMessage(res.data?.message || '');
    } catch (err) {
      console.error('Lỗi kiểm tra số dư đầu kỳ:', err);
      setHasOpeningBalance(false);
      setOpeningBalanceMessage('');
    }
  }, []);

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
      checkOpeningBalanceStatus,
      loading // Đưa biến loading ra ngoài để App.jsx xử lý màn hình chờ nếu muốn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được lồng bên trong cấu trúc của AuthProvider');
  }
  return context;
}