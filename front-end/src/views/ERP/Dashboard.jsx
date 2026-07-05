import React, { useState, useEffect } from 'react';
import { useRealTime, useBalanceUpdates } from '../../hooks/useRealTime';
import { useAuth } from '../../context/AuthContext';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText,
  Package,
  Users,
  RefreshCw
} from 'lucide-react';

// Dashboard with real-time metrics
export default function Dashboard() {
  const { user, activeCompany } = useAuth();
  const { vouchers, orders, isConnected } = useRealTime(
    activeCompany?.id, 
    user?.id
  );
  const { balanceUpdates } = useBalanceUpdates();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingOrders: 0,
    totalVouchers: 0
  });

  // Calculate metrics from real-time data
  useEffect(() => {
    const totalRevenue = vouchers
      .filter(v => v.type === 'receipt')
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    
    const totalExpenses = vouchers
      .filter(v => v.type === 'payment')
      .reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
    
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    setMetrics({
      totalRevenue,
      totalExpenses,
      pendingOrders,
      totalVouchers: vouchers.length
    });
  }, [vouchers, orders]);

  // Load initial data
  useEffect(() => {
    if (activeCompany) {
      setLoading(false);
    }
  }, [activeCompany]);

  // Metric card component
  const MetricCard = ({ icon: Icon, title, value, trend, color }) => (
    <div className="bg-white p-5 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`flex items-center text-xs ${
            trend > 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span className="ml-1">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-2xl font-black text-slate-800">
        {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
      </h3>
      <p className="text-xs font-medium text-slate-500 mt-1">{title}</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeCompany?.name || 'Chọn doanh nghiệp'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full ${
            isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {isConnected ? 'Realtime' : 'Offline'}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg border hover:bg-slate-50"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          title="Doanh thu"
          value={metrics.totalRevenue}
          trend={12}
          color="bg-emerald-100 text-emerald-600"
        />
        <MetricCard
          icon={TrendingDown}
          title="Chi phí"
          value={metrics.totalExpenses}
          trend={-5}
          color="bg-rose-100 text-rose-600"
        />
        <MetricCard
          icon={Package}
          title="Đơn hàng chờ"
          value={metrics.pendingOrders}
          color="bg-amber-100 text-amber-600"
        />
        <MetricCard
          icon={FileText}
          title="Tổng chứng từ"
          value={metrics.totalVouchers}
          color="bg-indigo-100 text-indigo-600"
        />
      </div>

      {/* Real-time updates section */}
      <div className="bg-white p-5 rounded-2xl border">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Cập nhật realtime
        </h2>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {vouchers.slice(0, 5).map(voucher => (
            <div 
              key={voucher.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" />
                <span className="text-sm font-medium">
                  {voucher.voucherNumber}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(voucher.date).toLocaleTimeString('vi-VN')}
              </span>
            </div>
          ))}
          
          {vouchers.length === 0 && (
            <div className="text-center text-slate-500 py-4">
              Chưa có dữ liệu realtime
            </div>
          )}
        </div>
      </div>
    </div>
  );
}