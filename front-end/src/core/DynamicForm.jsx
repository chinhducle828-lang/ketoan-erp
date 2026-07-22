/**
 * DynamicForm.jsx - Form động cho Server-Driven UI
 * Đọc UI Schema từ backend, tự động render fields
 * Dùng react-hook-form + Zod validation
 */

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { metaApi } from './MetaApiClient';
import { buildZodSchema } from './ValidationBuilder';
import FormFieldFactory from './FormFieldFactory';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/notify';

export default function DynamicForm({ entityType, onSubmit, companyId: propCompanyId, recordId, onCancel, mode = 'crud' }) {
  const { activeCompany } = useAuth();
  const companyId = propCompanyId || activeCompany?.id;

  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const isEditMode = !!recordId;

  // Fetch UI Schema từ backend
  useEffect(() => {
    if (!entityType || !companyId) return;
    setLoading(true);
    metaApi
      .getUISchema(entityType, companyId)
      .then(data => {
        setSchema(data);
      })
      .catch(err => {
        notify.error(`Lỗi tải form: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [entityType, companyId]);

  // Fetch existing data if in edit mode
  useEffect(() => {
    if (!recordId || !entityType || !companyId) return;
    
    setLoading(true);
    fetch(`/api/dynamic/${entityType}/${recordId}?company_id=${companyId}`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setInitialData(result.data);
        } else {
          notify.error('Không tìm thấy dữ liệu');
        }
      })
      .catch(err => {
        notify.error(`Lỗi tải dữ liệu: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [recordId, entityType, companyId]);

  // Build Zod validation schema từ config
  const validationSchema = useMemo(() => {
    if (!schema?.fields) return null;
    return buildZodSchema(schema.fields);
  }, [schema]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset
  } = useForm({
    resolver: validationSchema ? zodResolver(validationSchema) : undefined,
    mode: 'onBlur',
    defaultValues: initialData || {}
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Submit: gọi POST/PUT /api/dynamic/:entityType
  const onFormSubmit = async (data) => {
    setSubmitting(true);
    try {
      const url = isEditMode 
        ? `/api/dynamic/${entityType}/${recordId}`
        : `/api/dynamic/${entityType}`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          company_id: companyId
        })
      });
      const result = await res.json();

      if (result.success) {
        notify.success(isEditMode ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
        if (onSubmit) onSubmit(result.data);
      } else {
        notify.error(result.error || 'Lỗi xử lý');
      }
    } catch (err) {
      notify.error(err.message || 'Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-100 rounded w-1/3" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // Error: không có schema
  if (!schema) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-sm text-yellow-700">
        Không tìm thấy cấu hình form cho nghiệp vụ <strong>{entityType}</strong>.
        Vui lòng kiểm tra dữ liệu trong bảng <code>rea_meta</code>.
      </div>
    );
  }

  // Normalize sections: support both top-level `sections` and `layout.sections`
  const sections = schema.sections || schema?.layout?.sections || [];
  const fields = schema.fields || [];

  if (sections.length === 0 && fields.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-sm text-yellow-700">
        Cấu hình form cho nghiệp vụ <strong>{entityType}</strong> không có field nào.
        Vui lòng kiểm tra dữ liệu trong bảng <code>rea_meta</code>.
      </div>
    );
  }

  // Render form fields
  const renderFields = (fieldList) => (
    fieldList.map(field => (
      <div
        key={field.id}
        className={field.type === 'SUB_GRID' ? 'col-span-full' : ''}
      >
        <FormFieldFactory
          field={field}
          register={register}
          errors={errors}
          control={control}
        />
      </div>
    ))
  );

  // Render form
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {sections.length > 0 ? (
        // Render theo sections
        sections.map(section => (
          <fieldset key={section} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <legend className="text-lg font-bold text-slate-800 px-2 mb-4">{section}</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFields(schema.fields.filter(f => f.section === section))}
            </div>
          </fieldset>
        ))
      ) : (
        // Render phẳng (không section)
        <fieldset className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderFields(fields)}
          </div>
        </fieldset>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
          >
            Hủy
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 md:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang xử lý...
            </span>
          ) : (
            isEditMode ? 'Cập nhật' : 'Tạo mới'
          )}
        </button>
      </div>
    </form>
  );
}