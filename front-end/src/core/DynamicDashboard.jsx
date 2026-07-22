/**
 * DynamicDashboard.jsx - Universal dashboard đọc từ API
 * KHÔNG hard-coded: đọc metrics từ /api/dashboard, widgets từ config
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, RefreshCw } from 'lucide-react';

const WIDGET_TYPES = {
  'stat': ({ label, value, icon, trend, color }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900">
        {typeof value === 'number' ? value.toLocaleString('vi-VN') : value || '—'}
      </p>
    </div>
  ),
  'chart': ({ label, data }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 col-span-full">
      <h3 className="text-sm font-bold text-slate-700 mb-3">{label}</h3>
      <div className="h-48 flex items-end gap-2">
        {(data || []).map((item, i) => {
          const max = Math.max(...(data || []).map(d => d.value || 0), 1);
          const height = ((item.value || 0) / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400 font-mono">{item.value || 0}</span>
              <div className="w-full bg-blue-100 rounded-t" style={{ height: `${height}%`, minHeight: 4 }}>
                <div className="w-full bg-blue-600 rounded-t" style={{ height: '100%', opacity: 0.7 }} />
              </div>
              <span className="text-[9px] text-slate-500 truncate w-full text-center">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  ),
  'list': ({ label, items }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <h3 className="text-sm font-bold text-slate-700 mb-3">{label}</h3>
      <div className="space-y-2">
        {(items || []).slice(0, 10).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 truncate">{item.label || item.name || `Item ${i + 1}`}</span>
            <span className="font-mono font-bold text-slate-800 ml-2">
              {typeof item.value === 'number' ? item.value.toLocaleString('vi-VN') : item.value || ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
};

export default function DynamicDashboard({ dashboardId = 'default', companyId: propCompanyId }) {
  const { activeCompany } = useAuth();
  const companyId = propCompanyId || activeCompany?.id;

  const [config, setConfig] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // Đọc dashboard config từ API (có thể từ rea_meta hoặc dashboard_configs table)
      const configRes = await fetch(`/api/meta/${dashboardId}?company_id=${companyId}`, { credentials: 'include' });
      const configJson = await configRes.json();
      const dashboardConfig = configJson.success ? configJson.data?.ui_schema : null;

      // Fallback: tạo config mặc định
      const finalConfig = dashboardConfig || {
        title: 'Tổng quan',
        widgets: [
          { type: 'stat', id: 'total_vouchers', label: 'Tổng chứng từ', api: '/api/vouchers?company_id={companyId}', dataKey: 'total', icon: 'DollarSign' },
          { type: 'stat', id: 'total_revenue', label: 'Doanh thu', api: '/api/dashboard?company_id={companyId}', dataKey: 'revenue', icon: 'TrendingUp' },
          { type: 'stat', id: 'total_expense', label: 'Chi phí', api: '/api/dashboard?company_id={companyId}', dataKey: 'expense', icon: 'TrendingDown' },
          { type: 'stat', id: 'pending_approvals', label: 'Chờ duyệt', api: '/api/workflows/instances?company_id={companyId}&status=PENDING', dataKey: 'total', icon: 'Activity' },
          { type: 'list', id: 'recent_vouchers', label: 'Chứng từ gần đây', api: '/api/vouchers?company_id={companyId}&limit=10', dataKey: 'data' },
          { type: 'chart', id: 'monthly_balance', label: 'Số dư theo tháng', api: '/api/dashboard/cashflow?company_id={companyId}', dataKey: 'monthly' }
        ]
      };
      setConfig(finalConfig);

      // Load data cho từng widget
      const results = {};
      for (const widget of finalConfig.widgets || []) {
        try {
          const url = widget.api.replace('{companyId}', companyId);
          const res = await fetch(url, { credentials: 'include' });
          const json = await res.json();
          const rawData = widget.dataKey ? (json.data || json[widget.dataKey] || json) : json;
          results[widget.id] = rawData;
        } catch (e) {
          results[widget.id] = null;
        }
      }
      setData(results);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [companyId, dashboardId]);

  const resolveValue = (widget) => {
    const raw = data[widget.id];
    if (!raw) return '—';
    if (widget.valueKey) return raw[widget.valueKey];
    if (Array.isArray(raw)) return raw.length;
    if (typeof raw === 'object') return raw.total || raw.count || Object.keys(raw).length;
    return raw;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-1/3 animate-shimmer rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-800">{config?.title || 'Dashboard'}</h1>
        <button onClick={loadDashboard} className="p-2 hover:bg-slate-100 rounded-lg animate-btn">
          <RefreshCw size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-stagger">
        {(config?.widgets || []).map(widget => {
          const Widget = WIDGET_TYPES[widget.type];
          if (!Widget) return null;

          const widgetData = data[widget.id];
          const value = resolveValue(widget);

          return (
            <div key={widget.id} className="animate-hover-card">
              <Widget
                label={widget.label}
                value={value}
                trend={widgetData?.trend}
                data={widgetData}
                items={Array.isArray(widgetData) ? widgetData : widgetData?.data || []}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}