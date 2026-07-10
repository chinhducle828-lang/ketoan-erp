/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback } from 'react';
import VirtualTable from './VirtualTable';
import { FileText, RefreshCw, Filter } from 'lucide-react';
import api from '../utils/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation.js';
import { useRealTimeSync } from '../hooks/useRealTimeSync.js';

// Voucher list with real-time updates
export default function VoucherList({ companyId, userId }) {
  const { isConnected } = useSocket();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadVouchers = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await api.get('/vouchers', { params: { companyId } });
      const data = response.data?.data || response.data || [];
      setVouchers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load vouchers:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load vouchers on mount
  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  // Realtime: invalidate vouchers on voucher events
  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { vouchers: loadVouchers },
    {
      eventMap: {
        'voucher:created': ['vouchers'],
        'voucher:updated': ['vouchers'],
        'voucher:deleted': ['vouchers'],
        'voucher:posted': ['vouchers'],
        voucherCreated: ['vouchers'],
        voucherUpdated: ['vouchers'],
        voucherDeleted: ['vouchers'],
        voucherPosted: ['vouchers'],
        'closing:completed': ['vouchers'],
        closingCompleted: ['vouchers']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(companyId) });

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
            onClick={loadVouchers}
            disabled={loading}
            className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
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