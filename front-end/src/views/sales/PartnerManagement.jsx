// FILE_PATH: front-end/src/views/partner/PartnerManagement.jsx
import React, { useState, useMemo } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';

export default function PartnerManagement({ onRefresh }) {
  const { activeCompany } = useAuth();
  const [partner, setPartner] = useState({
    partner_code: '',
    partner_name: '',
    type: 'customer',
    phone: '',
    email: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { partners: () => onRefresh?.() },
    {
      eventMap: {
        'partner:updated': ['partners'],
        partnerUpdated: ['partners'],
        'voucher:created': ['partners'],
        'voucher:updated': ['partners'],
        'voucher:deleted': ['partners'],
        voucherCreated: ['partners'],
        voucherUpdated: ['partners'],
        voucherDeleted: ['partners']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(activeCompany && onRefresh) });

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    if (!activeCompany) return alert('Hãy chọn phân vùng công ty trước.');

    setLoading(true);
    try {
      await api.post('/partners', { ...partner, company_id: activeCompany.id });
      alert('Đăng ký danh mục đối tác thành công!');
      setPartner({ partner_code: '', partner_name: '', type: 'customer', phone: '', email: '', address: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Mã đối tác bị trùng lặp hoặc không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreatePartner} className="p-4 bg-white rounded-xl space-y-3">
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
  );
}