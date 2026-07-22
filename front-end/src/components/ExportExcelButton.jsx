/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl.js';
import { getAccountsByDepartment } from '../constants/accountsTT99.js';

export default function ExportExcelButton({ endpoint, filename, label = 'Xuất Excel', accountCodes }) {
  const { activeCompany, fiscalYear } = useAuth();

  const handleExport = async () => {
    if (!activeCompany?.id) return alert('Vui lòng chọn công ty trước khi xuất Excel.');
    try {
      const companyId = activeCompany.id;
      const token = localStorage.getItem('accessToken');
      
      // Build URL with token in Authorization header (download via fetch + blob)
      const params = new URLSearchParams({ company_id: companyId, year: fiscalYear });
      
      // Append account codes filter if provided
      if (accountCodes) {
        const codes = Array.isArray(accountCodes) ? accountCodes : [accountCodes];
        codes.forEach(code => params.append('account_code', code));
      }
      
      const res = await fetch(`${resolveApiBaseUrl()}/export/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Lỗi xuất Excel' }));
        throw new Error(err.error || 'Lỗi xuất Excel');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${companyId}_${fiscalYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Lỗi xuất Excel');
    }
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-sm"
      title={label}
    >
      <FileSpreadsheet size={14} />
      {label}
    </button>
  );
}
