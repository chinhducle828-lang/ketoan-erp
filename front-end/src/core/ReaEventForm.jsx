/**
 * ReaEventForm.jsx - Form động cho REA Event Processors
 * Gọi POST /api/events thay vì CRUD
 * KHÔNG hard-coded: đọc processor config từ EVENT_PROCESSORS registry
 */

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { metaApi } from './MetaApiClient';
import FormFieldFactory from './FormFieldFactory';
import { notify } from '../utils/notify';
import { Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// Field type mapping cho event processors
const FIELD_TYPE_MAP = {
  'TEXT': 'text',
  'NUMBER': 'number',
  'CURRENCY': 'number',
  'PERCENT': 'number',
  'DATE': 'date',
  'SELECT': 'select',
  'RADIO': 'radio',
  'SUB_GRID': 'subgrid'
};

export default function ReaEventForm({ entityType, companyId: propCompanyId, onSuccess, onCancel }) {
  const { activeCompany } = useAuth();
  const companyId = propCompanyId || activeCompany?.id;

  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Load UI schema từ meta API
  useEffect(() => {
    if (!entityType || !companyId) return;
    setLoading(true);
    metaApi.getUISchema(entityType, companyId)
      .then(data => setSchema(data))
      .catch(() => {
        // Fallback: tạo schema mặc định từ entity type
        setSchema({
          title: entityType.replace(/_/g, ' ').toUpperCase(),
          layout: { columns: 2, sections: ['Thông tin chung'] },
          fields: [
            { id: 'description', label: 'Diễn giải', type: 'TEXT', section: 'Thông tin chung', required: true },
            { id: 'amount', label: 'Số tiền', type: 'CURRENCY', section: 'Thông tin chung', required: true },
            { id: 'notes', label: 'Ghi chú', type: 'TEXT', section: 'Thông tin chung', required: false }
          ]
        });
      })
      .finally(() => setLoading(false));
  }, [entityType, companyId]);

  // Build Zod validation schema
  const validationSchema = useMemo(() => {
    if (!schema?.fields) return null;
    const shape = {};
    schema.fields.forEach(field => {
      let validator;
      switch (field.type) {
        case 'TEXT':
          validator = z.string();
          if (field.required) validator = validator.min(1, `${field.label} là bắt buộc`);
          break;
        case 'NUMBER':
        case 'CURRENCY':
        case 'PERCENT':
          validator = z.coerce.number();
          if (field.min !== undefined) validator = validator.min(field.min);
          if (field.max !== undefined) validator = validator.max(field.max);
          if (field.required) validator = validator.refine(v => v !== undefined && v !== null, { message: `${field.label} là bắt buộc` });
          break;
        case 'DATE':
          validator = z.string();
          if (field.required) validator = validator.min(1);
          break;
        case 'SELECT':
          validator = z.union([z.string(), z.number()]);
          if (field.required) validator = validator.refine(v => v !== undefined && v !== null && v !== '', { message: `${field.label} là bắt buộc` });
          break;
        case 'RADIO':
          validator = z.any();
          break;
        case 'SUB_GRID':
          validator = z.array(z.any()).optional();
          break;
        default:
          validator = z.any();
      }
      shape[field.id] = field.required ? validator : validator.optional();
    });
    return z.object(shape);
  }, [schema]);

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm({
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    mode: 'onBlur'
  });

  // Submit: gọi POST /api/events
  const onSubmit = async (data) => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entityType,
          company_id: companyId,
          ...data
        })
      });
      const json = await res.json();

      if (json.success) {
        setResult({ type: 'success', message: json.message, data: json.data });
        notify.success(json.message || 'Xử lý nghiệp vụ thành công!');
        if (onSuccess) onSuccess(json.data);
      } else if (json.status === 'REJECTED') {
        // Credit limit exceeded hoặc validation lỗi
        setResult({ type: 'rejected', message: json.reason || json.error, creditCheck: json.creditCheck });
        notify.error(json.reason || json.error);
      } else {
        setResult({ type: 'error', message: json.error || 'Lỗi xử lý nghiệp vụ' });
        notify.error(json.error || 'Lỗi xử lý nghiệp vụ');
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message });
      notify.error(err.message || 'Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-100 rounded w-1/3" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const sections = schema?.sections || schema?.layout?.sections || ['Thông tin chung'];
  const fields = schema?.fields || [];

  return (
    <div className="space-y-6">
      {/* Result display */}
      {result && (
        <div className={`p-4 rounded-xl border ${
          result.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
          result.type === 'rejected' ? 'bg-amber-50 border-amber-200' :
          'bg-rose-50 border-rose-200'
        }`}>
          <div className="flex items-start gap-3">
            {result.type === 'success' ? <CheckCircle className="text-emerald-600 mt-0.5" size={20} /> :
             result.type === 'rejected' ? <AlertCircle className="text-amber-600 mt-0.5" size={20} /> :
             <AlertCircle className="text-rose-600 mt-0.5" size={20} />}
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                result.type === 'success' ? 'text-emerald-800' :
                result.type === 'rejected' ? 'text-amber-800' :
                'text-rose-800'
              }`}>
                {result.type === 'success' ? 'Thành công' :
                 result.type === 'rejected' ? 'Bị từ chối' :
                 'Lỗi'}
              </p>
              <p className="text-sm mt-1">{result.message}</p>
              {result.creditCheck && (
                <div className="mt-2 text-xs space-y-1 bg-white/50 p-2 rounded">
                  <p>Hạn mức: {(result.creditCheck.creditLimit / 1000000).toFixed(0)}M</p>
                  <p>Dư nợ hiện tại: {(result.creditCheck.currentDebt / 1000000).toFixed(0)}M</p>
                  <p>Thiếu hụt: {(result.creditCheck.shortage / 1000000).toFixed(0)}M</p>
                </div>
              )}
              {result.data?.voucherId && (
                <p className="text-xs mt-2 font-mono">Voucher ID: {result.data.voucherId}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {sections.map(section => (
          <fieldset key={section} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <legend className="text-lg font-bold text-slate-800 px-2 mb-4">{section}</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields
                .filter(f => f.section === section)
                .map(field => (
                  <div key={field.id} className={field.type === 'SUB_GRID' ? 'col-span-full' : ''}>
                    <FormFieldFactory
                      field={field}
                      register={register}
                      errors={errors}
                      control={control}
                    />
                  </div>
                ))}
            </div>
          </fieldset>
        ))}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Đang xử lý...</>
            ) : (
              <><Send size={18} /> Xử lý nghiệp vụ</>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition text-sm font-bold"
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </div>
  );
}