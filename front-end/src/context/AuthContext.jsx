import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

// 1. Khởi tạo Context nội bộ (Không export trực tiếp dòng này)
const AuthContext = createContext(null);

// 2. Định nghĩa Component Provider (Bắt buộc viết hoa chữ cái đầu)
export function AuthProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')) || null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(Number(localStorage.getItem('activeCompany')) || null);
  
  // ĐỒNG BỘ NIÊN ĐỘ: Tự động lấy từ localStorage, nếu chưa có thì mặc định lấy năm hiện tại (2026)
  const [fiscalYear, setFiscalYearState] = useState(
    Number(localStorage.getItem('fiscalYear')) || 2026
  );

  // Hàm cập nhật Niên độ kế toán, đồng thời lưu vào localStorage để giữ trạng thái khi F5
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

  // Hàm Đăng ký Quản trị viên gốc (Bổ sung để sửa lỗi nút kích hoạt hệ thống gốc)
  const registerAdmin = async (username, password) => {
    try {
      const res = await api.post('/api/auth/register-admin', { username, password });
      return res.data;
    } catch (err) {
      // Ném lỗi chi tiết từ backend trả về (ví dụ: "Hệ thống đã có tài khoản quản trị viên!")
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
      
      if (res.data.user.company_id) {
        setActiveCompany(res.data.user.company_id);
        localStorage.setItem('activeCompany', res.data.user.company_id);
      }
      return res.data;
    } catch (err) {
      throw err.response?.data?.error || err.message || 'Lỗi đăng nhập trái phép';
    }
  };

  const logout = () => {
    try {
      // notify backend to invalidate session
      api.post('/api/auth/logout');
    } catch (e) {}
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCompanies([]);
    setActiveCompany(null);
    setFiscalYearState(2026); // Reset về niên độ mặc định khi đăng xuất
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
      fiscalYear,      // Truyền dữ liệu năm xuống Header và các phân hệ
      setFiscalYear,   // Truyền hàm cập nhật năm xuống Header
      changeCompany, 
      login, 
      logout, 
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

// ==========================================
// BẮT BUỘC CHO VITE: Export tập trung tất cả hook thuần ở cuối file
// ==========================================
export { useAuth };
// ==========================================   


      