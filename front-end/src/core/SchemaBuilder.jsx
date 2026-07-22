/**
 * SchemaBuilder.jsx - 3-step wizard cho admin tạo entity config
 * Step 1: Thông tin cơ bản (entity_type, table_name)
 * Step 2: UI Schema (fields, sections, layout)
 * Step 3: Grid Columns
 * KHÔNG hard-coded: đọc field types từ registry, options từ API
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { metaApi } from './MetaApiClient';
import { notify } from '../utils/notify';
import { Plus, X, ArrowLeft, ArrowRight, Save, Layout, Table, Settings } from 'lucide-react';

// Field type registry - có thể mở rộng bằng config
const FIELD_TYPES = [
  { value: 'TEXT', label: 'Văn bản', icon: 'Aa' },
  { value: 'NUMBER', label: 'Số', icon: '#' },
  { value: 'CURRENCY', label: 'Tiền tệ', icon: '₫' },
  { value: 'PERCENT', label: 'Phần trăm', icon: '%' },
  { value: 'DATE', label: 'Ngày tháng', icon: '📅' },
  { value: 'SELECT', label: 'Lựa chọn', icon: '▼' },
  { value: 'RADIO', label: 'Radio', icon: '◉' },
  { value: 'SUB_GRID', label: 'Bảng con', icon: '⊞' }
];

const COLUMN_TYPES = [
  { value: 'TEXT', label: 'Văn bản' },
  { value: 'CURRENCY', label: 'Tiền tệ' },
  { value: 'DATE', label: 'Ngày tháng' },
  { value: 'BADGE', label: 'Trạng thái' }
];

const DEFAULT_SECTIONS = ['Thông tin chung'];

export default function SchemaBuilder({ onComplete, initialEntityType }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [existingEntities, setExistingEntities] = useState([]);

  // Step 1: Basic info
  const [basicInfo, setBasicInfo] = useState({
    entity_type: initialEntityType || '',
    table_name: '',
    title: ''
  });

  // Step 2: UI Schema
  const [sections, setSections] = useState([...DEFAULT_SECTIONS]);
  const [fields, setFields] = useState([]);
  const [activeSection, setActiveSection] = useState(DEFAULT_SECTIONS[0]);

  // Step 3: Grid Columns
  const [gridColumns, setGridColumns] = useState([
    { key: 'id', title: 'Mã', sortable: true, width: 80 },
    { key: 'description', title: 'Diễn giải', sortable: true },
    { key: 'status', title: 'Trạng thái', type: 'BADGE', sortable: true },
    { key: 'created_at', title: 'Ngày tạo', type: 'DATE', sortable: true }
  ]);

  // Load existing entities for reference
  useEffect(() => {
    if (!companyId) return;
    metaApi.listEntities(companyId)
      .then(list => setExistingEntities(list))
      .catch(() => {});
  }, [companyId]);

  // Auto-generate table_name from entity_type
  const handleEntityTypeChange = (value) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    setBasicInfo(prev => ({
      ...prev,
      entity_type: clean,
      table_name: prev.table_name || `dynamic_${clean}`
    }));
  };

  // Add new field
  const addField = (section) => {
    const newField = {
      id: `field_${fields.length + 1}`,
      label: `Trường ${fields.length + 1}`,
      type: 'TEXT',
      section: section || activeSection,
      required: false,
      placeholder: '',
      options: []
    };
    setFields([...fields, newField]);
  };

  // Update field
  const updateField = (index, updates) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  // Remove field
  const removeField = (index) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  // Add section
  const addSection = () => {
    const name = `Phần ${sections.length + 1}`;
    setSections([...sections, name]);
    setActiveSection(name);
  };

  // Add grid column
  const addGridColumn = () => {
    setGridColumns([...gridColumns, { key: `col_${gridColumns.length + 1}`, title: `Cột ${gridColumns.length + 1}`, sortable: false }]);
  };

  // Update grid column
  const updateGridColumn = (index, updates) => {
    setGridColumns(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  // Remove grid column
  const removeGridColumn = (index) => {
    setGridColumns(prev => prev.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async () => {
    if (!basicInfo.entity_type) {
      notify.error('Vui lòng nhập tên loại nghiệp vụ');
      return;
    }
    if (fields.length === 0) {
      notify.error('Vui lòng thêm ít nhất 1 field');
      return;
    }

    setSubmitting(true);
    try {
      const uiSchema = {
        title: basicInfo.title || basicInfo.entity_type,
        layout: { columns: 2, sections },
        fields: fields.map(f => ({
          ...f,
          options: f.type === 'SELECT' || f.type === 'RADIO' ? (f.options || []) : undefined
        }))
      };

      const result = await metaApi.createEntity({
        entity_type: basicInfo.entity_type,
        table_name: basicInfo.table_name || undefined,
        ui_schema: uiSchema,
        grid_columns: gridColumns
      }, companyId);

      notify.success(`Tạo entity "${basicInfo.entity_type}" thành công!`);
      if (onComplete) onComplete(result);
    } catch (err) {
      notify.error(err.message || 'Lỗi tạo entity');
    } finally {
      setSubmitting(false);
    }
  };

  // Render field editor
  const renderFieldEditor = (field, index) => (
    <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Field #{index + 1}</span>
        <button onClick={() => removeField(index)} className="text-rose-500 hover:text-rose-700 p-1">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-slate-400">ID (field name)</label>
          <input
            type="text"
            value={field.id}
            onChange={e => updateField(index, { id: e.target.value.replace(/[^a-z0-9_]/g, '_') })}
            className="w-full border p-1.5 rounded text-xs font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Label</label>
          <input
            type="text"
            value={field.label}
            onChange={e => updateField(index, { label: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Type</label>
          <select
            value={field.type}
            onChange={e => updateField(index, { type: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Section</label>
          <select
            value={field.section}
            onChange={e => updateField(index, { section: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          >
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={field.required}
              onChange={e => updateField(index, { required: e.target.checked })}
            />
            Required
          </label>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-400">Placeholder</label>
          <input
            type="text"
            value={field.placeholder || ''}
            onChange={e => updateField(index, { placeholder: e.target.value })}
            className="w-full border p-1.5 rounded text-xs"
          />
        </div>
      </div>
      {/* Options editor for SELECT/RADIO */}
      {(field.type === 'SELECT' || field.type === 'RADIO') && (
        <div className="mt-2">
          <label className="text-[10px] font-semibold text-slate-400">Options</label>
          <div className="space-y-1 mt-1">
            {(field.options || []).map((opt, oi) => (
              <div key={oi} className="flex gap-1">
                <input
                  type="text"
                  value={opt.value}
                  onChange={e => {
                    const newOpts = [...(field.options || [])];
                    newOpts[oi] = { ...newOpts[oi], value: e.target.value };
                    updateField(index, { options: newOpts });
                  }}
                  placeholder="Value"
                  className="flex-1 border p-1 rounded text-[10px] font-mono"
                />
                <input
                  type="text"
                  value={opt.label}
                  onChange={e => {
                    const newOpts = [...(field.options || [])];
                    newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                    updateField(index, { options: newOpts });
                  }}
                  placeholder="Label"
                  className="flex-1 border p-1 rounded text-[10px]"
                />
                <button
                  onClick={() => {
                    const newOpts = (field.options || []).filter((_, j) => j !== oi);
                    updateField(index, { options: newOpts });
                  }}
                  className="text-rose-500 p-1"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => updateField(index, { options: [...(field.options || []), { value: '', label: '' }] })}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Thêm option
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {[
          { num: 1, label: 'Thông tin', icon: Settings },
          { num: 2, label: 'UI Schema', icon: Layout },
          { num: 3, label: 'Grid Columns', icon: Table }
        ].map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${
                step === s.num ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Thông tin cơ bản</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Entity Type *</label>
            <input
              type="text"
              value={basicInfo.entity_type}
              onChange={e => handleEntityTypeChange(e.target.value)}
              placeholder="Ví dụ: contract, project, expense_report"
              className="w-full border p-2 rounded-lg text-sm font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Tên loại nghiệp vụ, dùng để định danh trong URL</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Table Name</label>
            <input
              type="text"
              value={basicInfo.table_name}
              onChange={e => setBasicInfo(prev => ({ ...prev, table_name: e.target.value }))}
              placeholder="dynamic_{entity_type}"
              className="w-full border p-2 rounded-lg text-sm font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Tên bảng trong database (mặc định: dynamic_{entity_type})</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
            <input
              type="text"
              value={basicInfo.title}
              onChange={e => setBasicInfo(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Tên hiển thị (mặc định: entity_type)"
              className="w-full border p-2 rounded-lg text-sm"
            />
          </div>

          {/* Existing entities reference */}
          {existingEntities.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Entity đã tồn tại</label>
              <div className="flex flex-wrap gap-1">
                {existingEntities.map(e => (
                  <span key={e.entity_type} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600">
                    {e.entity_type}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
              Tiếp theo <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: UI Schema */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">UI Schema - Form Fields</h2>
            <div className="flex gap-2">
              <button onClick={addSection} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200">
                <Plus size={14} /> Thêm section
              </button>
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 border-b pb-2">
            {sections.map(s => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 rounded-t text-xs font-bold transition ${
                  activeSection === s ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Fields in active section */}
          <div className="space-y-3">
            {fields.filter(f => f.section === activeSection).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Chưa có field nào trong section này</p>
            )}
            {fields.map((field, index) => (
              <div key={`${field.id}-${index}`}>
                {renderFieldEditor(field, index)}
              </div>
            ))}
          </div>

          <button
            onClick={() => addField(activeSection)}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center"
          >
            <Plus size={16} /> Thêm field vào "{activeSection}"
          </button>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold hover:bg-slate-200">
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button onClick={() => setStep(3)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
              Tiếp theo <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Grid Columns */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Grid Columns</h2>
          <p className="text-sm text-slate-500">Cấu hình các cột hiển thị trong danh sách</p>

          <div className="space-y-2">
            {gridColumns.map((col, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <input
                  type="text"
                  value={col.key}
                  onChange={e => updateGridColumn(index, { key: e.target.value })}
                  placeholder="Key"
                  className="flex-1 border p-1.5 rounded text-xs font-mono"
                />
                <input
                  type="text"
                  value={col.title}
                  onChange={e => updateGridColumn(index, { title: e.target.value })}
                  placeholder="Title"
                  className="flex-1 border p-1.5 rounded text-xs"
                />
                <select
                  value={col.type || 'TEXT'}
                  onChange={e => updateGridColumn(index, { type: e.target.value })}
                  className="border p-1.5 rounded text-xs"
                >
                  {COLUMN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={col.sortable || false}
                    onChange={e => updateGridColumn(index, { sortable: e.target.checked })}
                  />
                  Sort
                </label>
                <input
                  type="number"
                  value={col.width || ''}
                  onChange={e => updateGridColumn(index, { width: parseInt(e.target.value) || undefined })}
                  placeholder="W"
                  className="w-16 border p-1.5 rounded text-xs"
                />
                <button onClick={() => removeGridColumn(index)} className="text-rose-500 p-1">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addGridColumn}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center"
          >
            <Plus size={16} /> Thêm cột
          </button>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold hover:bg-slate-200">
              <ArrowLeft size={16} /> Quay lại
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save size={16} />
              {submitting ? 'Đang tạo...' : 'Tạo Entity'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}