/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Package, Loader2, RefreshCw, TrendingUp, AlertTriangle, Search, FileSpreadsheet } from 'lucide-react';
import api from '../../utils/api.js';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';
import { getAccountsByDepartment, ACCOUNTS_TT99 } from '../../constants/accountsTT99.js';
import { WORKFLOW_EVENTS } from '../../workflow/accountingWorkflow.js';
import { INVENTORY_TABLE_COLUMNS, INVENTORY_STATS, INVENTORY_MESSAGES } from '../../constants/inventoryTable.js';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function InventoryManagement() {
  const { activeCompany } = useAuth();
  const [stockLevels, setStockLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [costingLoading, setCostingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const loadStockLevels = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError('');
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.get(`/inventory/stock-levels?company_id=${companyId}`);
      setStockLevels(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error('Lỗi tải tồn kho:', err);
      setError('Không thể tải dữ liệu tồn kho. Vui lòng thử lại.');
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    loadStockLevels();
  }, [loadStockLevels]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { inventory: loadStockLevels },
    {
      eventMap: {
        'inventory:updated': ['inventory'],
        inventoryUpdated: ['inventory'],
        'voucher:created': ['inventory'],
        'voucher:updated': ['inventory'],
        'voucher:deleted': ['inventory'],
        voucherCreated: ['inventory'],
        voucherUpdated: ['inventory'],
        voucherDeleted: ['inventory'],
        'closing:completed': ['inventory'],
        closingCompleted: ['inventory']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(activeCompany) });

  const handleRunCosting = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn chạy tính giá vốn cuối kỳ? Quá trình này sẽ tính toán lại giá xuất kho theo phương pháp BQGQ/FIFO.')) return;
    setCostingLoading(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const res = await api.post('/inventory/costing', { company_id: companyId });
      alert(res.data?.message || 'Tính giá vốn hoàn tất!');
      loadStockLevels();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi tính giá vốn!');
    } finally {
      setCostingLoading(false);
    }
  };

  // Lọc theo tên/mã vật tư
  const filteredStock = stockLevels.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.item_name?.toLowerCase().includes(term) ||
      b.item_code?.toLowerCase().includes(term)
    );
  });

  const formatAmount = (amount) => {
    return Math.round(amount || 0)?.toLocaleString('vi-VN');
  };

  const stats = useMemo(() => [
    {
      label: INVENTORY_STATS.totalItems.label,
      value: stockLevels.length,
      icon: Package,
      colorClass: INVENTORY_STATS.totalItems.color
    },
    {
      label: INVENTORY_STATS.totalQuantity.label,
      value: formatAmount(stockLevels.reduce((sum, b) => sum + parseFloat(b.current_stock || 0), 0)),
      icon: TrendingUp,
      colorClass: INVENTORY_STATS.totalQuantity.color
    },
    {
      label: INVENTORY_STATS.totalValue.label,
      value: `${formatAmount(stockLevels.reduce((sum, b) => sum + parseFloat((b.current_stock || 0) * (b.unit_price || 0)), 0))} đ`,
      icon: FileSpreadsheet,
      colorClass: INVENTORY_STATS.totalValue.color
    }
  ], [stockLevels]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package size={22} className="text-indigo-600" />
            Quản Lý Kho Tổng Hợp
          </h1>
          <p className="text-xs text-slate-400 mt-1">Dashboard tồn kho, lịch sử nhập/xuất và tính giá vốn cuối kỳ</p>
        </div>
        <div className="flex gap-2">
          <ImportExcelButton endpoint="inventory" filename="Ton_Kho" accountCodeField="accountCode" />
          <ExportExcelButton endpoint="inventory" filename="Ton_Kho" accountCodes={ACCOUNTS_TT99.filter(a => a.group === 'inventory' || a.group === 'cogs').map(a => a.code)} />
          <button
            onClick={loadStockLevels}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={handleRunCosting}
            disabled={costingLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition"
          >
            {costingLoading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            Tính Giá Vốn Cuối Kỳ
          </button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      {!loading && stockLevels.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-400 font-semibold">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.colorClass}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Thanh tìm kiếm */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo mã vật tư, tên hàng hóa..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </div>

      {/* Bảng tồn kho */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-slate-400">{INVENTORY_MESSAGES.loading}</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <AlertTriangle size={40} className="mb-2 text-amber-400" />
            <p className="text-sm">{error}</p>
            <button 
              onClick={loadStockLevels}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              {INVENTORY_MESSAGES.retry}
            </button>
          </div>
        ) : filteredStock.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Package size={40} className="mb-2 opacity-30" />
            <p className="text-sm">{INVENTORY_MESSAGES.noData}</p>
            <p className="text-xs mt-1">{INVENTORY_MESSAGES.noDataHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  {Object.entries(INVENTORY_TABLE_COLUMNS).map(([key, col]) => (
                    <th key={key} className={`p-3 ${col.className}`} style={{ width: col.width }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((b, idx) => (
                  <tr key={b.item_code || idx} className="border-b hover:bg-slate-50/50 transition">
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.code.className}`}>
                      {b.item_code || '-'}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.name.className}`} title={b.item_name}>
                      {b.item_name || 'N/A'}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.unit.className}`}>
                      {b.unit || '-'}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.openingQuantity.className}`}>
                      {b.opening_quantity}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.inbound.className}`}>
                      {INVENTORY_TABLE_COLUMNS.inbound.prefix}{b.inbound}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.outbound.className}`}>
                      {INVENTORY_TABLE_COLUMNS.outbound.prefix}{b.outbound}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.currentStock.className}`}>
                      {b.current_stock}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.unitPrice.className}`}>
                      {b.unit_price ? formatAmount(b.unit_price) : '-'}
                    </td>
                    <td className={`p-3 ${INVENTORY_TABLE_COLUMNS.stockValue.className}`}>
                      {formatAmount((b.current_stock || 0) * (b.unit_price || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hướng dẫn */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Hướng dẫn nghiệp vụ kho</p>
            <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
              <li>Sử dụng phân hệ <strong>Mua hàng & Vật tư nhập kho</strong> để nhập kho</li>
              <li>Sử dụng phân hệ <strong>Hóa đơn bán hàng Excel</strong> để xuất kho</li>
              <li>Chạy <strong>Tính giá vốn cuối kỳ</strong> sau khi hoàn tất nhập/xuất trong kỳ</li>
              <li>Giá vốn được tính theo phương pháp Bình quân gia quyền (BQGQ) hoặc FIFO</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}