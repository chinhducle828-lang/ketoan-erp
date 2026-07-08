/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { formatDisplayDate, formatPrice } from '../utils/formatters';
import { warehouseApi } from '../utils/api';
import { WAREHOUSE_STATUS_OPTIONS, WAREHOUSE_STATUS_TYPES } from '../constants';

const WarehouseTracker = ({
  warehouseQueue,
  warehouseLoading,
  warehouseStatusFilter,
  setWarehouseStatusFilter,
  companyId,
  storefrontToken,
  t
}) => {
  const [actionLoading, setActionLoading] = useState({});

  const handleAssignTruck = async (voucherId) => {
    setActionLoading((prev) => ({ ...prev, [voucherId]: true }));
    try {
      await warehouseApi.assignTruck(companyId, voucherId, null, storefrontToken);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi phân xe');
    } finally {
      setActionLoading((prev) => ({ ...prev, [voucherId]: false }));
    }
  };

  const handleConfirmLoaded = async (voucherId) => {
    setActionLoading((prev) => ({ ...prev, [voucherId]: true }));
    try {
      await warehouseApi.confirmLoaded(companyId, voucherId, storefrontToken);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xác nhận');
    } finally {
      setActionLoading((prev) => ({ ...prev, [voucherId]: false }));
    }
  };

  const handleMarkCompleted = async (voucherId) => {
    setActionLoading((prev) => ({ ...prev, [voucherId]: true }));
    try {
      await warehouseApi.markCompleted(companyId, voucherId, storefrontToken);
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi hoàn thành');
    } finally {
      setActionLoading((prev) => ({ ...prev, [voucherId]: false }));
    }
  };

  if (warehouseLoading) {
    return <div className="p-4 text-center">{t('loading', 'VI')}</div>;
  }

  if (!warehouseQueue.length) {
    return <div className="p-4 text-center text-slate-500">Không có đơn hàng nào</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Lọc trạng thái:</label>
        <select
          value={warehouseStatusFilter}
          onChange={(e) => setWarehouseStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1"
        >
          {WAREHOUSE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {warehouseQueue.map((order) => (
          <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex justify-between">
<span className="font-semibold">Mã: {order.voucherNumber || order.id}</span>
              <span className="text-sm text-slate-500">
                {formatDisplayDate(order.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm">{order.customerName}</p>
            <p className="text-sm font-bold text-emerald-600">
              {formatPrice(order.amount, 'VND')}
            </p>
            
            <div className="mt-2 flex gap-2">
              {order.loading_status === WAREHOUSE_STATUS_TYPES.pendingLoading && (
                <button
                  onClick={() => handleAssignTruck(order.id)}
                  disabled={actionLoading[order.id]}
                  className="rounded-lg bg-amber-100 px-3 py-1 text-sm"
                >
                  Phân xe
                </button>
              )}
              {order.loading_status === WAREHOUSE_STATUS_TYPES.assigned && (
                <button
                  onClick={() => handleConfirmLoaded(order.id)}
                  disabled={actionLoading[order.id]}
                  className="rounded-lg bg-sky-100 px-3 py-1 text-sm"
                >
                  Xác nhận xuất kho
                </button>
              )}
              {order.loading_status === WAREHOUSE_STATUS_TYPES.delivering && (
                <button
                  onClick={() => handleMarkCompleted(order.id)}
                  disabled={actionLoading[order.id]}
                  className="rounded-lg bg-emerald-100 px-3 py-1 text-sm"
                >
                  Hoàn thành
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WarehouseTracker;