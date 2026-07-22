/**
 * WorkflowBuilder.jsx - Visual workflow builder (no hard-code)
 * Đọc step types, action types, trigger events từ config
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { metaApi } from './MetaApiClient';
import { notify } from '../utils/notify';
import { Plus, X, Save, ArrowRight, GitBranch, CheckSquare, Bell, Clock, Mail } from 'lucide-react';

const STEP_TYPES = [
  { value: 'CONDITION', label: 'Điều kiện', icon: GitBranch, color: 'amber' },
  { value: 'APPROVAL', label: 'Phê duyệt', icon: CheckSquare, color: 'blue' },
  { value: 'ACTION', label: 'Hành động', icon: ArrowRight, color: 'green' },
  { value: 'NOTIFICATION', label: 'Thông báo', icon: Bell, color: 'purple' },
  { value: 'DELAY', label: 'Chờ', icon: Clock, color: 'slate' }
];

const ACTION_TYPES = [
  { value: 'GENERATE_VOUCHER', label: 'Tạo chứng từ' },
  { value: 'SEND_EMAIL', label: 'Gửi email' },
  { value: 'CALL_API', label: 'Gọi API' },
  { value: 'SET_VARIABLE', label: 'Đặt biến' }
];

const TRIGGER_EVENTS = [
  'sales_opportunity', 'purchase_requisition', 'inventory_transfer',
  'voucher:created', 'voucher:posted', 'orderStatusChanged',
  'sales_credit', 'purchase_with_fee', 'advance_clearing'
];

export default function WorkflowBuilder({ workflow, companyId: propCompanyId, onComplete }) {
  const { activeCompany } = useAuth();
  const companyId = propCompanyId || activeCompany?.id;

  const [form, setForm] = useState({
    workflow_name: '',
    workflow_code: '',
    description: '',
    trigger_event: '',
    trigger_conditions: {},
    steps: [],
    variables: {},
    priority: 0
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workflow) {
      setForm({
        workflow_name: workflow.workflow_name || '',
        workflow_code: workflow.workflow_code || '',
        description: workflow.description || '',
        trigger_event: workflow.trigger_event || '',
        trigger_conditions: workflow.trigger_conditions || {},
        steps: workflow.steps || [],
        variables: workflow.variables || {},
        priority: workflow.priority || 0
      });
    }
  }, [workflow]);

  const addStep = () => {
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, {
        type: 'CONDITION',
        name: `Bước ${prev.steps.length + 1}`,
        condition: '',
        approver_role: '',
        action: '',
        config: {},
        message: '',
        delay_ms: 0
      }]
    }));
  };

  const updateStep = (index, updates) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? { ...s, ...updates } : s)
    }));
  };

  const removeStep = (index) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!form.workflow_name || !form.workflow_code || !form.trigger_event || form.steps.length === 0) {
      notify.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setSubmitting(true);
    try {
      const url = workflow?.id
        ? `/api/workflows/${workflow.id}`
        : '/api/workflows';
      const method = workflow?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, company_id: companyId })
      });
      const json = await res.json();

      if (json.success) {
        notify.success(workflow?.id ? 'Cập nhật workflow thành công!' : 'Tạo workflow thành công!');
        if (onComplete) onComplete(json.data);
      } else {
        notify.error(json.error || 'Lỗi xử lý');
      }
    } catch (err) {
      notify.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepEditor = (step, index) => (
    <div key={index} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(() => {
            const st = STEP_TYPES.find(t => t.value === step.type);
            const Icon = st?.icon || ArrowRight;
            return <Icon size={16} className={`text-${st?.color || 'slate'}-600`} />;
          })()}
          <span className="text-sm font-bold text-slate-700">Bước {index + 1}</span>
          <span className="text-xs text-slate-400">{step.type}</span>
        </div>
        <button onClick={() => removeStep(index)} className="text-rose-500 p-1 hover:bg-rose-50 rounded">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Tên bước</label>
          <input
            type="text" value={step.name}
            onChange={e => updateStep(index, { name: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Loại</label>
          <select
            value={step.type}
            onChange={e => updateStep(index, { type: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          >
            {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {step.type === 'CONDITION' && (
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-slate-400">Điều kiện (JavaScript expression)</label>
            <input
              type="text" value={step.condition}
              onChange={e => updateStep(index, { condition: e.target.value })}
              placeholder="Ví dụ: payload.amount > 10000000"
              className="w-full border p-1.5 rounded text-xs font-mono"
            />
          </div>
        )}

        {step.type === 'APPROVAL' && (
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-slate-400">Vai trò phê duyệt</label>
            <select
              value={step.approver_role}
              onChange={e => updateStep(index, { approver_role: e.target.value })}
              className="w-full border p-1.5 rounded text-xs"
            >
              <option value="">Chọn vai trò...</option>
              <option value="admin">Admin</option>
              <option value="ktt">Kế toán trưởng</option>
              <option value="gd_kinhdoanh">Giám đốc kinh doanh</option>
              <option value="manager">Quản lý</option>
            </select>
          </div>
        )}

        {step.type === 'ACTION' && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-slate-400">Hành động</label>
              <select
                value={step.action}
                onChange={e => updateStep(index, { action: e.target.value })}
                className="w-full border p-1.5 rounded text-xs"
              >
                <option value="">Chọn hành động...</option>
                {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400">Config (JSON)</label>
              <input
                type="text" value={JSON.stringify(step.config)}
                onChange={e => {
                  try { updateStep(index, { config: JSON.parse(e.target.value) }); }
                  catch { updateStep(index, { config: e.target.value }); }
                }}
                className="w-full border p-1.5 rounded text-xs font-mono"
              />
            </div>
          </>
        )}

        {step.type === 'NOTIFICATION' && (
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-slate-400">Nội dung thông báo</label>
            <input
              type="text" value={step.message}
              onChange={e => updateStep(index, { message: e.target.value })}
              className="w-full border p-1.5 rounded text-xs"
            />
          </div>
        )}

        {step.type === 'DELAY' && (
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-slate-400">Thời gian chờ (ms)</label>
            <input
              type="number" value={step.delay_ms}
              onChange={e => updateStep(index, { delay_ms: parseInt(e.target.value) || 0 })}
              className="w-full border p-1.5 rounded text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-800">
          {workflow?.id ? 'Chỉnh sửa Workflow' : 'Tạo Workflow mới'}
        </h2>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tên workflow *</label>
            <input type="text" value={form.workflow_name}
              onChange={e => setForm(prev => ({ ...prev, workflow_name: e.target.value }))}
              className="w-full border p-2 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Mã workflow *</label>
            <input type="text" value={form.workflow_code}
              onChange={e => setForm(prev => ({ ...prev, workflow_code: e.target.value }))}
              className="w-full border p-2 rounded-lg text-sm font-mono" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Trigger Event *</label>
            <select value={form.trigger_event}
              onChange={e => setForm(prev => ({ ...prev, trigger_event: e.target.value }))}
              className="w-full border p-2 rounded-lg text-sm">
              <option value="">Chọn sự kiện kích hoạt...</option>
              {TRIGGER_EVENTS.map(evt => (
                <option key={evt} value={evt}>{evt}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Mô tả</label>
            <textarea value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border p-2 rounded-lg text-sm" rows={2} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
            <input type="number" value={form.priority}
              onChange={e => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
              className="w-full border p-2 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Các bước xử lý</h3>
          <button onClick={addStep} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
            <Plus size={14} /> Thêm bước
          </button>
        </div>

        {form.steps.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Chưa có bước nào. Nhấn "Thêm bước" để bắt đầu.
          </div>
        )}

        <div className="space-y-3">
          {form.steps.map((step, i) => renderStepEditor(step, i))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save size={16} />
          {submitting ? 'Đang lưu...' : workflow?.id ? 'Cập nhật' : 'Tạo Workflow'}
        </button>
      </div>
    </div>
  );
}