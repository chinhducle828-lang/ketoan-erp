import React from 'react';
import { useOrderStatus } from '../hooks/useRealTime';
import { Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';

// Order status component with real-time updates
export default function OrderStatus({ orderId, initialStatus = 'pending' }) {
  const { orderUpdates } = useOrderStatus();
  const order = orderUpdates[orderId] || { status: initialStatus };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        icon: Clock,
        color: 'text-yellow-500',
        bg: 'bg-yellow-50',
        label: 'Chờ xử lý',
        progress: 10
      },
      processing: {
        icon: Package,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        label: 'Đang xử lý',
        progress: 50
      },
      shipping: {
        icon: Truck,
        color: 'text-indigo-500',
        bg: 'bg-indigo-50',
        label: 'Đang giao',
        progress: 75
      },
      completed: {
        icon: CheckCircle,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
        label: 'Hoàn thành',
        progress: 100
      },
      cancelled: {
        icon: XCircle,
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        label: 'Đã hủy',
        progress: 0
      }
    };
    return configs[status] || configs.pending;
  };

  const config = getStatusConfig(order.status);
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-xl border ${config.bg} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={config.color} size={20} />
          <span className="font-semibold text-slate-700">{config.label}</span>
        </div>
        <span className="text-xs text-slate-500">
          {order.lastUpdate && new Date(order.lastUpdate).toLocaleTimeString('vi-VN')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${config.color.replace('text-', 'bg-')}`}
          style={{ width: `${config.progress}%` }}
        />
      </div>

      {/* Real-time indicator */}
      {order.lastUpdate && (
        <div className="mt-2 text-xs text-slate-400">
          Cập nhật: {new Date(order.lastUpdate).toLocaleTimeString('vi-VN')}
        </div>
      )}
    </div>
  );
}

// Order list with real-time status
export function OrderList({ orders }) {
  return (
    <div className="space-y-3">
      {orders.map(order => (
        <OrderStatus 
          key={order.id} 
          orderId={order.id} 
          initialStatus={order.status} 
        />
      ))}
    </div>
  );
}