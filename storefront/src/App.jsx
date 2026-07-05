import React from 'react';
import OrderStatus from './components/OrderStatus.jsx';
import VoucherNotification from './components/VoucherNotification.jsx';

// Main App component
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">Ketoan Storefront</h1>
        <VoucherNotification />
      </header>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-lg font-semibold text-slate-700">
            Trạng thái đơn hàng realtime
          </h2>
          
          {/* Order status list */}
          <div className="space-y-4">
            <OrderStatus orderId="1" initialStatus="pending" />
            <OrderStatus orderId="2" initialStatus="processing" />
            <OrderStatus orderId="3" initialStatus="shipping" />
          </div>
        </div>
      </main>
    </div>
  );
}