/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/views/partner/PartnerManagement.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRealtimeCacheSync } from '../../hooks/useRealtimeCacheSync.js';
import { notify } from '../../utils/notify.jsx';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function PartnerManagement({ onRefresh }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;
  
  const [partner, setPartner] = useState({
    partner_code: '',
    partner_name: '',
    type: 'customer',
    phone: '',
    email: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  // React Query for partners list (if needed for display)
  const { data: partnersList = [] } = useQuery({
    queryKey: ['partners', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await api.get(`/partners/list?company_id=${companyId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  // Realtime cache sync
  useRealtimeCacheSync({
    queries: [
      { key: ['partners', companyId] }
    ],
    events: ['partnerUpdated', 'voucherCreated', 'voucherUpdated', 'voucherDeleted'],
    enabled: !!companyId
  });

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    if (!activeCompany) {
      notify.error('Hãy chọn phân vùng công ty trước.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/partners', { ...partner, company_id: activeCompany.id });
      notify.success('Đăng ký danh mục đối tác thành công!');
      setPartner({ partner_code: '', partner_name: '', type: 'customer', phone: '', email: '', address: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      notify.error(err.response?.data?.error || 'Mã đối tác bị trùng lặp hoặc không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-xl space-y-3">
      <div className="flex gap-2">
        <ImportExcelButton endpoint="partners" filename="Doi_Tac" label="Nhập Excel" />
        <ExportExcelButton endpoint="partners" filename="Doi_Tac" label="Xuất Excel" />
      </div>
      <form onSubmit={handleCreatePartner} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Mã đối tác (Mã KH/NCC)..." required value={partner.partner_code}
          onChange={e => setPartner({...partner, partner_code: e.target.value})}
          className="text-xs p-2 border rounded-lg" />
        <input placeholder="Tên đối tác doanh nghiệp..." required value={partner.partner_name}
          onChange={e => setPartner({...partner, partner_name: e.target.value})}
          className="text-xs p-2 border rounded-lg" />
      </div>
      <select value={partner.type} onChange={e => setPartner({...partner, type: e.target.value})}
        className="text-xs p-2 border rounded-lg w-full">
        <option value="customer">Khách hàng (Tài khoản 131)</option>
        <option value="vendor">Nhà cung cấp (Tài khoản 331)</option>
        <option value="both">Lưỡng tính (Cả KH và NCC)</option>
      </select>
      <button type="submit" disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-lg disabled:opacity-50">
        {loading ? 'Đang cập nhật danh mục công nợ...' : 'Lưu thông tin đối tác'}
      </button>
    </form>
    </div>
  );
}