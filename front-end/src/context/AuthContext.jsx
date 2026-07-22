/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api, { setAccessToken, clearAccessToken } from '../utils/api.js';

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
      clearAccessToken();
      localStorage.removeItem('accessToken');
      setUser(null);
      setActiveCompany(null);
    };
    window.addEventListener('erp:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('erp:auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initSession = async () => {
      const existingToken = localStorage.getItem('accessToken');
      if (!existingToken || cancelled) {
        setIsSyncing(false);
        return;
      }
      // Sync localStorage token to in-memory storage for api.js interceptor
      setAccessToken(existingToken);
      try {
        const userRes = await api.get('/auth/me');
        if (cancelled) return;
        setUser(userRes.data.user);
        setFiscalYear(userRes.data.fiscal_year);

        const storedCompany = localStorage.getItem('activeCompany');
        let parsedStoredCompany = null;
        if (storedCompany) {
          try {
            parsedStoredCompany = JSON.parse(storedCompany);
          } catch {
            parsedStoredCompany = null;
          }
        }

        // SỬA: Gọi API trực tiếp, không dùng fetchCompanies (tránh race condition do callback reference change)
        const { data: companiesData } = await api.get('/companies');
        if (cancelled) return;
        const fetchedCompanies = Array.isArray(companiesData) ? companiesData : companiesData?.data || [];
        setCompanies(fetchedCompanies);

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
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401) {
          console.warn('Phiên làm việc đã hết hạn, yêu cầu đăng nhập lại.');
          clearAccessToken();
          localStorage.removeItem('accessToken');
          localStorage.removeItem('activeCompany');
          setUser(null);
          setActiveCompany(null);
        } else {
          console.warn('Khởi tạo phiên tạm thời thất bại, sẽ thử lại khi gọi API:', err?.message);
        }
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    initSession();
    return () => { cancelled = true; };
  }, []); // SỬA: dependency = [] để chỉ chạy 1 lần, tránh race condition

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    setAccessToken(data.accessToken);
    localStorage.setItem('accessToken', data.accessToken);
    const loggedInUser = {
      ...(data.user || {}),
      must_change_password: Boolean(data?.user?.must_change_password ?? data?.must_change_password),
      // Enhanced RBAC: Include clearance_level from backend
      clearance_level: data.user?.clearance_level ?? data.clearance_level ?? 1
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
      clearAccessToken();
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
    clearAccessToken();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('activeCompany');
    setUser(null);
    setActiveCompany(null);

    return data;
  }, []);

  const changeCompany = useCallback((company) => {
    setActiveCompany(company);
    localStorage.setItem('activeCompany', JSON.stringify(company));
    // Đồng bộ company_id sang Storefront (cùng origin, cross-tab)
    localStorage.setItem('shopCompanyId', String(company.id));
    // Đánh dấu thời điểm đồng bộ để Storefront phát hiện thay đổi
    localStorage.setItem('erp:company-changed', String(Date.now()));
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
          year: new Date().getFullYear()
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

  // Memo hóa context value, loại bỏ token khỏi dependency để tránh re-render vô hạn
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