import React, { useEffect, useState } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LogisticsDashboard() {
  const { activeCompany } = useAuth();
  const [orders, setOrders] = useState([]);
  const companyId = activeCompany?.id;

  const loadQueue = async () => {
    if (!companyId) {
      setOrders([]);
      return;
    }
    const res = await api.get('/logistics/queue', { params: { company_id: companyId } });
    setOrders(res.data || []);
  };

  useEffect(() => {
    loadQueue().catch(() => setOrders([]));
  }, [companyId]);

  const assignTruck = async (voucherId, truckId) => {
    if (!companyId) return;
    await api.post('/logistics/assign-truck', { companyId, voucherId, truckId });
    await loadQueue();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Logistics / Giao hàng</h1>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Đơn hàng chờ phân xe</h2>
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border p-3">
              <div className="font-medium">{order.voucher_number}</div>
              <div className="text-sm text-slate-500">{order.description}</div>
              <button onClick={() => assignTruck(order.id, 1)} className="mt-2 rounded bg-indigo-600 px-3 py-2 text-sm text-white">
                Gán xe 01
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
