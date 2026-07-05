import React, { useEffect, useState } from 'react';
import OrderStatus from './components/OrderStatus.jsx';
import VoucherNotification from './components/VoucherNotification.jsx';
import { useRealTime } from './hooks/useRealTime';
import { orderAPI } from './services/api';

// Main App component
export default function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Mock company and user IDs (in real app, get from auth context)
  const companyId = '1';
  const userId = '1';
  
  // Initialize real-time connection
  const { isConnected, connectionStatus } = useRealTime(companyId, userId);
  
  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await orderAPI.getAll({ company_id: companyId, limit: 10 });
        if (response.data.success) {
          setOrders(response.data.data);
        }
      } catch (error) {
        console.error('Lỗi lấy danh sách đơn hàng:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [companyId]);
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">Ketoan Storefront</h1>
        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-600">
              {isConnected ? 'Đã kết nối' : 'Mất kết nối'}
            </span>
          </div>
          <VoucherNotification />
        </div>
      </header>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">
              Trạng thái đơn hàng realtime
            </h2>
            <span className="text-sm text-slate-500">
              {orders.length} đơn hàng
            </span>
          </div>
          
          {/* Order status list */}
          {loading ? (
            <div className="text-center py-8 text-slate-500">
              Đang tải đơn hàng...
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map(order => (
                <OrderStatus 
                  key={order.id} 
                  orderId={order.id} 
                  initialStatus={order.status} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Chưa có đơn hàng nào
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
