/**
 * WorkflowDashboard.jsx - Quản lý workflow instances + approvals
 * KHÔNG hard-coded: đọc từ /api/workflows
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import WorkflowBuilder from '../../../core/WorkflowBuilder';
import { notify } from '../../../utils/notify';
import { GitBranch, Plus, CheckCircle, XCircle, RefreshCw, ArrowLeft, Activity } from 'lucide-react';

export default function WorkflowDashboard() {
  const { activeCompany, user } = useAuth();
  const companyId = activeCompany?.id;

  const [view, setView] = useState('list'); // list | create | edit | instances | approvals
  const [workflows, setWorkflows] = useState([]);
  const [instances, setInstances] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [wfRes, instRes] = await Promise.all([
        fetch(`/api/workflows?company_id=${companyId}`, { credentials: 'include' }),
        fetch(`/api/workflows/instances?company_id=${companyId}&limit=50`, { credentials: 'include' })
      ]);
      const wfJson = await wfRes.json();
      const instJson = await instRes.json();
      if (wfJson.success) setWorkflows(wfJson.data || []);
      if (instJson.success) setInstances(instJson.data || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (view === 'list' || view === 'instances') loadData(); }, [view, companyId]);

  const handleApprove = async (instanceId) => {
    try {
      const res = await fetch(`/api/workflows/instances/${instanceId}/approve`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: 'Approved' })
      });
      const json = await res.json();
      if (json.success) { notify.success('Đã phê duyệt'); loadData(); }
      else notify.error(json.error);
    } catch (err) { notify.error(err.message); }
  };

  const handleReject = async (instanceId) => {
    try {
      const res = await fetch(`/api/workflows/instances/${instanceId}/reject`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: 'Rejected' })
      });
      const json = await res.json();
      if (json.success) { notify.success('Đã từ chối'); loadData(); }
      else notify.error(json.error);
    } catch (err) { notify.error(err.message); }
  };

  const handleDelete = async (workflowId) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (json.success) { notify.success('Đã xóa workflow'); loadData(); }
      else notify.error(json.error);
    } catch (err) { notify.error(err.message); }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'COMPLETED': 'bg-green-100 text-green-700',
      'PENDING': 'bg-yellow-100 text-yellow-700',
      'FAILED': 'bg-red-100 text-red-700',
      'CANCELLED': 'bg-slate-100 text-slate-600',
      'APPROVED': 'bg-emerald-100 text-emerald-700',
      'REJECTED': 'bg-rose-100 text-rose-700'
    };
    return `px-2 py-0.5 rounded text-[10px] font-bold ${colors[status] || 'bg-slate-100 text-slate-600'}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'list' && view !== 'instances' && (
            <button onClick={() => { setView('list'); setEditingWorkflow(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <GitBranch size={24} className="text-indigo-600" />
              Workflow Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {view === 'list' ? 'Quản lý workflow và instances' :
               view === 'create' ? 'Tạo workflow mới' :
               view === 'edit' ? 'Chỉnh sửa workflow' :
               view === 'instances' ? 'Lịch sử thực thi' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(view === 'instances' ? 'list' : 'instances')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${
              view === 'instances' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            <Activity size={14} /> Instances
          </button>
          <button onClick={() => setView('create')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
            <Plus size={14} /> Tạo Workflow
          </button>
        </div>
      </div>

      {/* Builder View */}
      {(view === 'create' || view === 'edit') && (
        <WorkflowBuilder workflow={editingWorkflow} companyId={companyId}
          onComplete={() => { setView('list'); setEditingWorkflow(null); }} />
      )}

      {/* Instances View */}
      {view === 'instances' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Workflow Instances</h2>
            <button onClick={loadData} disabled={loading} className="p-1.5 hover:bg-slate-100 rounded">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {instances.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">Chưa có instance nào</div>
            ) : instances.map(inst => (
              <div key={inst.id} className="p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-700">{inst.workflow_name}</span>
                    <span className={`ml-2 ${getStatusBadge(inst.status)}`}>{inst.status}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(inst.started_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400">{inst.trigger_event}</span>
                  {inst.status === 'PENDING' && (
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => handleApprove(inst.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                        <CheckCircle size={14} />
                      </button>
                      <button onClick={() => handleReject(inst.id)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="grid gap-4">
          {workflows.map(wf => (
            <div key={wf.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{wf.workflow_name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{wf.workflow_code}</p>
                </div>
                <span className="text-[10px] text-slate-400">{wf.trigger_event}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">{wf.description}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-slate-400">{wf.steps?.length || 0} bước</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  wf.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>{wf.is_active ? 'Active' : 'Inactive'}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => { setEditingWorkflow(wf); setView('edit'); }}
                    className="px-2 py-1 text-[10px] text-blue-600 hover:bg-blue-50 rounded font-bold">Sửa</button>
                  <button onClick={() => handleDelete(wf.id)}
                    className="px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50 rounded font-bold">Xóa</button>
                </div>
              </div>
            </div>
          ))}
          {workflows.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <GitBranch size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Chưa có workflow nào. Tạo workflow đầu tiên!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}