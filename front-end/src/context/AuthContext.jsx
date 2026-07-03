// FILE_PATH: front-end/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [isSyncing, setIsSyncing] = useState(true); // Trạng thái đồng bộ phiên làm việc ban đầu
  const [hasOpeningBalance, setHasOpeningBalance] = useState(null); // null = chưa kiểm tra, true = có, false = chưa có
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const initSession = async () => {
      try {
        // Thực hiện cơ chế Silent Refresh trước để cấp lại Access Token mới từ HttpOnly Cookie
        const { data } = await api.post('/auth/refresh');
        if (data && data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          
          // Sau đó tiến hành lấy thông tin tài khoản và niên độ kế toán từ Server
          const userRes = await api.get('/auth/me');
          setUser(userRes.data.user);
          setFiscalYear(userRes.data.fiscal_year);
          
          // Phục hồi dữ liệu phân vùng doanh nghiệp làm việc
          const storedCompany = localStorage.getItem('activeCompany');
          if (storedCompany) {
            setActiveCompany(JSON.parse(storedCompany));
          }
          
          // ✅ FIX: Tải danh sách công ty từ database khi khởi động phiên làm việc
          await fetchCompanies();
        }
      } catch (err) {
        console.warn('Phiên làm việc hết hạn hoặc chưa được đăng nhập trước đó.');
        localStorage.removeItem('accessToken');
      } finally {
        setIsSyncing(false); // Hoàn tất quá trình đồng bộ, cho phép ứng dụng render UI chính thức
      }
    };

    initSession();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
    setFiscalYear(data.fiscal_year);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('activeCompany');
      setUser(null);
      setActiveCompany(null);
    }
  };

  const changeCompany = (company) => {
    setActiveCompany(company);
    localStorage.setItem('activeCompany', JSON.stringify(company));
  };

  // Lấy danh sách công ty
  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
      return res.data;
    } catch (err) {
      console.error('Lỗi tải danh sách công ty:', err);
      return [];
    }
  };

  // Lấy danh sách người dùng
  const loadUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || res.data);
      return res.data.users || res.data;
    } catch (err) {
      console.error('Lỗi tải danh sách người dùng:', err);
      return [];
    }
  };

  // Kiểm tra trạng thái số dư đầu kỳ
  const checkOpeningBalanceStatus = async (companyId) => {
    try {
      const res = await api.get(`/opening-balances?company_id=${companyId}&year=2026`);
      const hasBalance = Array.isArray(res.data) && res.data.length > 0;
      setHasOpeningBalance(hasBalance);
      return hasBalance;
    } catch (err) {
      setHasOpeningBalance(false);
      return false;
    }
  };

  // Tính toán token từ localStorage
  const token = localStorage.getItem('accessToken');
  const mustChangePassword = user?.must_change_password || user?.mustChangePassword || false;

  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold text-slate-600 tracking-wider">ĐANG ĐỒNG BỘ PHIÊN LÀM VIỆC KẾ TOÁN...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      activeCompany, 
      fiscalYear, 
      login, 
      logout, 
      changeCompany,
      token,
      mustChangePassword,
      loading: isSyncing,
      hasOpeningBalance,
      checkOpeningBalanceStatus,
      companies,
      users,
      fetchCompanies,
      loadUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);