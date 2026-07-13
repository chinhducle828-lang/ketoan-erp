/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import VirtualTable from './VirtualTable';
import { FileText, RefreshCw, Filter } from 'lucide-react';
import api from '../utils/api.js';
import { useSocket } from '../hooks/useSocket.js';
import { useRealtimeCacheSync } from '../hooks/useRealtimeCacheSync.js';

// Voucher list with real-time updates
export default function VoucherList({ companyId, userId }) {
  const { isConnected } = useSocket();
  const [filter, setFilter] = useState('all');

  // React Query: Fetch vouchers
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vouchers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const response = await api.get('/vouchers', { params: { companyId } });
      const data = response.data?.data || response.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(companyId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Real-time cache sync
  useRealtimeCacheSync({
    queries: [['vouchers']],
    events: [
      'voucher:created',
      'voucher:updated',
      'voucher:deleted',
      'voucher:posted',
      'closing:completed',
      'closing:reopened'
    ],
    enabled: Boolean(companyId)
  });

  const refresh = () => {
    // Invalidate and refetch vouchers
    window.location.reload();
  };

  // Filter vouchers
  const filteredVouchers = vouchers.filter(voucher => {
    if (filter === 'all') return true;
    return voucher.type === filter;
  });

  // Table columns
  const columns = [
    { key: 'voucherNumber', label: 'Số chứng từ', width: 150, sortable: true },
    { key: 'date', label: 'Ngày', width: 120, sortable: true },
    { key: 'type', label: 'Loại', width: 100 },
    { key: 'description', label: 'Mô tả', flex: 1 },
    { 
      key: 'amount', 
      label: 'Số tiền', 
      width: 150,
      sortable: true,
      render: (value) => `${Number(value).toLocaleString('vi-VN')} đ`
    },
    { key: 'status', label: 'Trạng thái', width: 100 }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="text-indigo-600" size={20} />
          <h2 className="text-lg font-bold text-slate-800">Danh sách chứng từ</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {isConnected ? 'Realtime' : 'Offline'}
          </span>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm"
          >
            <option value="all">Tất cả</option>
            <option value="receipt">Phiếu thu</option>
            <option value="payment">Phiếu chi</option>
            <option value="invoice">Hóa đơn</option>
          </select>
          
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Voucher count */}
      <div className="text-sm text-slate-500">
        {filteredVouchers.length} chứng từ {filter !== 'all' && `(đã lọc)`}
      </div>

      {/* Virtual table */}
      <VirtualTable
        data={filteredVouchers}
        columns={columns}
        rowHeight={50}
        visibleRows={10}
        onRowClick={(voucher) => console.log('Voucher clicked:', voucher)}
      />
    </div>
  );
}