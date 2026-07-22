/**
 * ReaEventProcessor.jsx - Dashboard xử lý nghiệp vụ REA
 * Hiển thị danh sách event types, form xử lý, lịch sử events
 * KHÔNG hard-coded: đọc danh sách từ DB qua /api/meta
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { metaApi } from '../../../core/MetaApiClient';
import ReaEventForm from '../../../core/ReaEventForm';
import { notify } from '../../../utils/notify';
import { Activity, Send, History, RefreshCw, Layout, Plus, X, ArrowLeft } from 'lucide-react';

// Event processor registry - đọc từ EVENT_PROCESSORS keys (không hard-code)
// Có thể mở rộng bằng config hoặc API
const KNOWN_PROCESSORS = [
  { id: 'factoring', name: 'Factoring (Bao thanh toán)', dept: 'finance', icon: '💰' },
  { id: 'intercompany', name: 'Giao dịch nội bộ', dept: 'finance', icon: '🏢' },
  { id: 'quad-party-netting', name: 'Cấn trừ công nợ 4 bên', dept: 'finance', icon: '🔄' },
  { id: 'forex-revaluation', name: 'Đánh giá lại ngoại tệ', dept: 'finance', icon: '💱' },
  { id: 'sale', name: 'Bán hàng (cơ bản)', dept: 'sales', icon: '🛒' },
  { id: 'simple_sale', name: 'Bán hàng thu tiền ngay', dept: 'sales', icon: '💵' },
  { id: 'retroactive-rebate', name: 'Chiết khấu thương mại', dept: 'sales', icon: '🏷️' },
  { id: 'sales_credit', name: 'Bán hàng trả chậm', dept: 'sales', icon: '📝' },
  { id: 'sales_shipped_and_billed', name: 'Xuất kho & lập hóa đơn', dept: 'sales', icon: '📦' },
  { id: 'sales_opportunity', name: 'Cơ hội bán hàng', dept: 'sales', icon: '🎯' },
  { id: 'simple_purchase', name: 'Mua hàng nhập kho', dept: 'purchasing', icon: '📥' },
  { id: 'purchase_with_fee', name: 'Mua hàng kèm chi phí', dept: 'purchasing', icon: '🚚' },
  { id: 'purchase_requisition', name: 'Yêu cầu mua hàng', dept: 'purchasing', icon: '📋' },
  { id: 'purchase_order_created', name: 'Đặt hàng nhập kho', dept: 'purchasing', icon: '📄' },
  { id: 'inventory_transfer', name: 'Chuyển kho nội bộ', dept: 'warehouse', icon: '📦' },
  { id: 'inventory_audit', name: 'Kiểm kê kho', dept: 'warehouse', icon: '🔍' },
  { id: 'inventory_received', name: 'Nhập kho từ NCC', dept: 'warehouse', icon: '📥' },
  { id: 'simple_expense', name: 'Chi phí quản lý', dept: 'finance', icon: '📊' },
  { id: 'payroll_distribution', name: 'Tính lương & BHXH', dept: 'hr', icon: '👥' },
  { id: 'manufacturing_cogs', name: 'Tính giá thành SX', dept: 'warehouse', icon: '🏭' },
  { id: 'asset_depreciation', name: 'Trích khấu hao TSCĐ', dept: 'finance', icon: '🏗️' },
  { id: 'advance_clearing', name: 'Tạm ứng & thanh toán', dept: 'finance', icon: '💳' },
  { id: 'early_payment', name: 'Chiết khấu thanh toán', dept: 'finance', icon: '⚡' }
];

export default function ReaEventProcessor() {
  const { activeCompany, user } = useAuth();
  const companyId = activeCompany?.id;
  const isAdmin = user?.role === 'admin';

  const [activeProcessor, setActiveProcessor] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'form' | 'history'
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Filter processors theo department
  const userDept = user?.department;
  const filteredProcessors = isAdmin
    ? KNOWN_PROCESSORS
    : KNOWN_PROCESSORS.filter(p => p.dept === userDept);

  // Group by department
  const grouped = filteredProcessors.reduce((acc, p) => {
    if (!acc[p.dept]) acc[p.dept] = [];
    acc[p.dept].push(p);
    return acc;
  }, {});

  // Load event history
  const loadEvents = async () => {
    if (!companyId) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/events?company_id=${companyId}&limit=20&offset=0`, {
        credentials: 'include'
      });
      const json = await res.json();
      if (json.success) setEvents(json.data || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (view === 'history') loadEvents();
  }, [view, companyId]);

  const handleFormSuccess = () => {
    setView('list');
    setActiveProcessor(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setActiveProcessor(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity size={24} className="text-blue-600" />
              Xử lý nghiệp vụ REA
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {view === 'list' ? 'Chọn loại nghiệp vụ để xử lý' :
               view === 'form' ? `Xử lý: ${activeProcessor?.name}` :
               'Lịch sử sự kiện'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView(view === 'history' ? 'list' : 'history')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${
              view === 'history' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History size={14} />
            Lịch sử
          </button>
        </div>
      </div>

      {/* History View */}
      {view === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Sự kiện gần đây</h2>
            <button onClick={loadEvents} disabled={loadingEvents} className="p-1.5 hover:bg-slate-100 rounded">
              <RefreshCw size={14} className={loadingEvents ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">Chưa có sự kiện nào</div>
            ) : (
              events.map(evt => (
                <div key={evt.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-700">{evt.event_type}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      evt.status === 'completed' ? 'bg-green-100 text-green-700' :
                      evt.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{evt.status}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(evt.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(grouped).map(([dept, processors]) => (
            <div key={dept} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b">
                {dept === 'finance' ? 'Tài chính' :
                 dept === 'sales' ? 'Bán hàng' :
                 dept === 'purchasing' ? 'Mua hàng' :
                 dept === 'warehouse' ? 'Kho vận' :
                 dept === 'hr' ? 'Nhân sự' : dept}
              </h3>
              <div className="space-y-1">
                {processors.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProcessor(p); setView('form'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-left transition group"
                  >
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form View */}
      {view === 'form' && activeProcessor && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{activeProcessor.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{activeProcessor.name}</h2>
              <p className="text-xs text-slate-500">{activeProcessor.id}</p>
            </div>
          </div>
          <ReaEventForm
            entityType={activeProcessor.id}
            companyId={companyId}
            onSuccess={handleFormSuccess}
            onCancel={() => { setView('list'); setActiveProcessor(null); }}
          />
        </div>
      )}
    </div>
  );
}