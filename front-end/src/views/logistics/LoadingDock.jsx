/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRealtimeCacheSync } from '../../hooks/useRealtimeCacheSync.js';

export default function LoadingDock() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  // React Query for loading dock queue
  const { data: orders = [], isLoading: loading } = useQuery({
    queryKey: ['loadingDockQueue', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await api.get('/logistics/queue', { params: { company_id: companyId } });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Realtime cache sync
  useRealtimeCacheSync({
    queries: [
      { key: ['loadingDockQueue', companyId] }
    ],
    events: ['orderStatusChanged', 'voucherCreated', 'voucherUpdated', 'voucherDeleted'],
    enabled: !!companyId
  });

  const handleConfirm = async (voucherId) => {
    if (!companyId) return;
    // Lấy thông tin order để có số tiền thực tế
    const order = orders.find(o => o.id === voucherId);
    await api.post('/logistics/confirm-loaded', { 
      companyId, 
      voucherId, 
      amount: order?.total_amount || 0, 
      costAmount: order?.cost_amount || 0, 
      taxAmount: order?.tax_amount || 0 
    });
    // React Query will automatically refetch and update the list
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
