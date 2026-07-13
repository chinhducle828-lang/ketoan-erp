/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
      return res.data;
    } catch (err) {
      console.error('Lỗi tải danh sách công ty:', err);
      return [];
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/auth/users');
      const nextUsers = res.data.users || res.data;
      setUsers(nextUsers);
      return nextUsers;
    } catch (err) {
      console.error('Lỗi tải danh sách người dùng:', err);
      return [];
    }
  }, []);

  // Lắng nghe sự kiện token hết hạn từ response interceptor
  useEffect(() => {
    const handleAuthExpired = () => {
      localStorage.removeItem('accessToken');
      setUser(null);
      setActiveCompany(null);
    };
    window.addEventListener('erp:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('erp:auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const initSession = async () => {
      const existingToken = localStorage.getItem('accessToken');
      if (!existingToken) {
        setIsSyncing(false);
        return;
      }
      try {
        // /auth/me tự động qua interceptor: nếu access token hết hạn sẽ silent-refresh (có cooldown)
        const userRes = await api.get('/auth/me');
        setUser(userRes.data.user);
        setFiscalYear(userRes.data.fiscal_year);

        // Phục hồi dữ liệu phân vùng doanh nghiệp làm việc
        const storedCompany = localStorage.getItem('activeCompany');
        let parsedStoredCompany = null;
        if (storedCompany) {
          try {
            parsedStoredCompany = JSON.parse(storedCompany);
          } catch {
            parsedStoredCompany = null;
          }
        }

        // ✅ FIX: Tải danh sách công ty từ database khi khởi động phiên làm việc
        const fetchedCompanies = await fetchCompanies();

        // Nếu tài khoản mới đăng nhập chưa có activeCompany, tự chọn công ty đầu tiên được cấp quyền.
        const matchedCompany = parsedStoredCompany?.id
          ? fetchedCompanies.find((c) => Number(c.id) === Number(parsedStoredCompany.id))
          : null;

        const defaultCompany = matchedCompany || fetchedCompanies[0] || null;
        if (defaultCompany) {
          setActiveCompany(defaultCompany);
          localStorage.setItem('activeCompany', JSON.stringify(defaultCompany));
        } else {
          setActiveCompany(null);
          localStorage.removeItem('activeCompany');
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          // Phiên thực sự hết hạn / mất cookie → dọn trạng thái, về trang login
          console.warn('Phiên làm việc đã hết hạn, yêu cầu đăng nhập lại.');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('activeCompany');
          setUser(null);
          setActiveCompany(null);
        } else {
          // Lỗi tạm thời (429/500/network): GIỮ nguyên token, KHÔNG ép logout.
          // Các request tiếp theo sẽ tự động thử lại qua interceptor (có cooldown).
          console.warn('Khởi tạo phiên tạm thời thất bại, sẽ thử lại khi gọi API:', err?.message);
        }
      } finally {
        setIsSyncing(false); // Hoàn tất quá trình đồng bộ, cho phép ứng dụng render UI chính thức
      }
    };

    initSession();
  }, [fetchCompanies]);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('accessToken', data.accessToken);
    const loggedInUser = {
      ...(data.user || {}),
      must_change_password: Boolean(data?.user?.must_change_password ?? data?.must_change_password)
    };
    setUser(loggedInUser);
    setFiscalYear(data.fiscal_year);

    const fetchedCompanies = await fetchCompanies();
    const storedCompany = localStorage.getItem('activeCompany');
    let parsedStoredCompany = null;
    if (storedCompany) {
      try {
        parsedStoredCompany = JSON.parse(storedCompany);
      } catch {
        parsedStoredCompany = null;
      }
    }

    const matchedCompany = parsedStoredCompany?.id
      ? fetchedCompanies.find((c) => Number(c.id) === Number(parsedStoredCompany.id))
      : null;
    const defaultCompany = matchedCompany || fetchedCompanies[0] || null;

    if (defaultCompany) {
      setActiveCompany(defaultCompany);
      localStorage.setItem('activeCompany', JSON.stringify(defaultCompany));
    } else {
      setActiveCompany(null);
      localStorage.removeItem('activeCompany');
    }

    // Điều hướng cho vai trò gd_kinhdoanh được xử lý tại Login.jsx (bên trong Router)
    // để tránh reload toàn trang (window.location.href) và giữ nguyên trạng thái SPA.

    return data;
  }, [fetchCompanies]);

  const logout = useCallback(async () => {
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
  }, []);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', { oldPassword, newPassword });

    // Backend đã hủy toàn bộ session sau khi đổi mật khẩu,
    // nên client cũng dọn trạng thái để buộc đăng nhập lại.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('activeCompany');
    setUser(null);
    setActiveCompany(null);

    return data;
  }, []);

  const changeCompany = useCallback((company) => {
    setActiveCompany(company);
    localStorage.setItem('activeCompany', JSON.stringify(company));
  }, []);

  // Kiểm tra trạng thái số dư đầu kỳ
  const checkOpeningBalanceStatus = useCallback(async (companyId) => {
    try {
      if (!companyId) {
        setHasOpeningBalance(false);
        return false;
      }
      const res = await api.get('/opening-balances', { 
        params: { 
          company_id: companyId,
          year: 2026 
        } 
      });
      const hasBalance = Array.isArray(res.data) && res.data.length > 0;
      setHasOpeningBalance(hasBalance);
      return hasBalance;
    } catch (err) {
      // Nếu lỗi 403 (không có quyền) thì coi như chưa có số dư để không chặn người dùng
      if (err.response?.status === 403) {
        console.warn('Không có quyền kiểm tra số dư đầu kỳ, bỏ qua kiểm tra');
        setHasOpeningBalance(true); // Cho phép truy cập các phân hệ khác
        return true;
      }
      setHasOpeningBalance(false);
      return false;
    }
  }, []);

  // Tính toán token từ localStorage
  const token = localStorage.getItem('accessToken');
  const mustChangePassword = user?.must_change_password || user?.mustChangePassword || false;

  const contextValue = useMemo(() => ({
    user,
    activeCompany,
    fiscalYear,
    login,
    logout,
    changePassword,
    changeCompany,
    token,
    mustChangePassword,
    loading: isSyncing,
    hasOpeningBalance,
    checkOpeningBalanceStatus,
    companies,
    users,
    fetchCompanies,
    loadUsers,
    setFiscalYear
  }), [
    user,
    activeCompany,
    fiscalYear,
    login,
    logout,
    changePassword,
    changeCompany,
    token,
    mustChangePassword,
    isSyncing,
    hasOpeningBalance,
    checkOpeningBalanceStatus,
    companies,
    users,
    fetchCompanies,
    loadUsers
  ]);

  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold text-slate-600 tracking-wider">ĐANG ĐỒNG BỘ PHIÊN LÀM VIỆC KẾ TOÁN...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);