/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoadingDock() {
  const { activeCompany } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const companyId = activeCompany?.id;

  const loadQueue = async () => {
    if (!companyId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const res = await api.get('/logistics/queue', { params: { company_id: companyId } });
    setOrders(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    loadQueue().catch(() => setLoading(false));
  }, [companyId]);

  const handleConfirm = async (voucherId) => {
    if (!companyId) return;
    await api.post('/logistics/confirm-loaded', { companyId, voucherId, amount: 1000000, costAmount: 500000, taxAmount: 100000 });
    setOrders((prev) => prev.filter((order) => order.id !== voucherId));
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <h1 className="text-4xl font-bold mb-6">MÀN HÌNH BÃI XÚC</h1>
      <p className="text-lg mb-6">Nhấn xác nhận sau khi đã xúc xong để kích hoạt kế toán và cho xe xuất bến.</p>
      {loading ? <div>Đang tải...</div> : orders.length === 0 ? <div>Không có xe chờ xúc.</div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.map((order) => (
            <div key={order.id} className="rounded-3xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-2xl font-semibold">{order.voucher_number}</div>
              <div className="mt-2 text-slate-300">{order.description}</div>
              <button onClick={() => handleConfirm(order.id)} className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-6 text-3xl font-bold">
                XÁC NHẬN ĐÃ XÚC
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
