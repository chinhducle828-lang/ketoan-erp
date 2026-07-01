import React, { useRef } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

export default function ImportExcelButton({ endpoint, filename, label = 'Nhập Excel' }) {
  const { activeCompany, fiscalYear } = useAuth();
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!activeCompany?.id) {
      alert('Vui lòng chọn công ty trước khi nhập Excel.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_id', activeCompany.id);
    formData.append('year', fiscalYear || 2026);

    try {
      const res = await api.post(`/api/import/${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data?.success) {
        alert(`Nhập Excel thành công!\n${res.data.message || `Đã xử lý file ${file.name}`}`);
        // Trigger a custom event to refresh data
        window.dispatchEvent(new CustomEvent('excel-imported', { detail: { endpoint } }));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi nhập Excel');
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <label className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-sm cursor-pointer">
      <FileSpreadsheet size={14} />
      {label}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>
  );
}