import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { Trash2, Building2 } from 'lucide-react';

export default function CompanyList({ companies, onRefresh }) {
  const [loading, setLoading] = useState(false);

  const handleDeleteCompany = async (companyId, companyName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa công ty "${companyName}"? Hành động này không thể hoàn tác!`)) {
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/api/companies/${companyId}`);
      alert('Đã xóa công ty thành công!');
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xóa công ty!');
    } finally {
      setLoading(false);
    }
  };

  if (!companies || companies.length === 0) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
          <Building2 size={16} className="text-blue-600" /> Danh sách công ty / Pháp nhân
        </h3>
        <p className="text-sm text-slate-500 text-center py-6">Chưa có công ty nào. Vui lòng thêm công ty mới bên trên.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <Building2 size={16} className="text-blue-600" /> Danh sách công ty / Pháp nhân
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <th className="p-3">Tên công ty</th>
              <th className="p-3">Mã số thuế</th>
              <th className="p-3">Địa chỉ</th>
              <th className="p-3 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map(company => (
              <tr key={company.id} className="hover:bg-slate-50/50 transition">
                <td className="p-3 font-bold text-slate-700">{company.name}</td>
                <td className="p-3 text-slate-600">{company.tax_code}</td>
                <td className="p-3 text-slate-600">{company.address || '--'}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDeleteCompany(company.id, company.name)}
                    disabled={loading}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Xóa công ty"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
