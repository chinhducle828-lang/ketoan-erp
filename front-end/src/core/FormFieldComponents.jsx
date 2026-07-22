/**
 * FormFieldComponents.js - Base components cho mọi field type
 * Dùng cho DynamicForm Server-Driven UI
 */

import { useWatch, useFieldArray } from 'react-hook-form';

// ====================================================================
// BASE INPUTS
// ====================================================================

export function TextInput({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <input
        {...register(field.id)}
        placeholder={field.placeholder || ''}
        className={`w-full border p-2 rounded-lg text-sm ${error ? 'border-red-500' : 'border-slate-200'}`}
      />
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function NumberInput({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <input
        type="number"
        step="any"
        {...register(field.id, { valueAsNumber: true })}
        placeholder={field.placeholder || '0'}
        className={`w-full border p-2 rounded-lg text-sm ${error ? 'border-red-500' : 'border-slate-200'}`}
      />
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function CurrencyInput({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          {...register(field.id, { valueAsNumber: true })}
          placeholder="0"
          className={`w-full border p-2 rounded-lg text-sm pl-8 ${error ? 'border-red-500' : 'border-slate-200'}`}
        />
        <span className="absolute left-2.5 top-2 text-slate-400 text-sm">₫</span>
      </div>
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function SelectInput({ field, register, error, control, watchedValues }) {
  // Fetch data nếu có dependsOn
  const dependsValue = field.dependsOn?.field
    ? useWatch({ control, name: field.dependsOn.field })
    : null;

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <select
        {...register(field.id)}
        className={`w-full border p-2 rounded-lg text-sm ${error ? 'border-red-500' : 'border-slate-200'}`}
      >
        <option value="">-- Chọn {field.label} --</option>
        {(field.options || []).map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {dependsValue !== null && (
        <p className="text-xs text-blue-500">Phụ thuộc: {field.dependsOn.field} = {dependsValue}</p>
      )}
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function DateInput({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <input
        type="date"
        {...register(field.id)}
        className={`w-full border p-2 rounded-lg text-sm ${error ? 'border-red-500' : 'border-slate-200'}`}
      />
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function PercentInput({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          {...register(field.id, { valueAsNumber: true })}
          placeholder="0"
          className={`w-full border p-2 rounded-lg text-sm pr-8 ${error ? 'border-red-500' : 'border-slate-200'}`}
        />
        <span className="absolute right-2.5 top-2 text-slate-400 text-sm">%</span>
      </div>
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function RadioGroup({ field, register, error }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{field.label}</label>
      <div className="flex gap-4">
        {(field.options || []).map(opt => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value={opt.value}
              {...register(field.id)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}

export function SubGrid({ field, register, error, control }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: field.id
  });

  // Ensure at least one row
  if (fields.length === 0) {
    // We can't call append during render, so we show empty state
    return (
      <div className="space-y-1 col-span-full">
        <label className="text-xs font-semibold text-slate-500">{field.label}</label>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {(field.subFields || []).map(sf => (
                  <th key={sf.id} className="p-2 text-left text-xs font-semibold text-slate-500">{sf.label}</th>
                ))}
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={(field.subFields?.length || 0) + 1} className="p-4 text-center text-slate-400 text-xs">
                  Chưa có dữ liệu
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            const emptyRow = {};
            (field.subFields || []).forEach(sf => { emptyRow[sf.id] = ''; });
            append(emptyRow);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm dòng
        </button>
        {error && <p className="text-red-500 text-xs">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1 col-span-full">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500">{field.label}</label>
        <button
          type="button"
          onClick={() => {
            const emptyRow = {};
            (field.subFields || []).forEach(sf => { emptyRow[sf.id] = ''; });
            append(emptyRow);
          }}
          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-bold hover:bg-blue-100 transition"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {(field.subFields || []).map(sf => (
                <th key={sf.id} className="p-2 text-left text-xs font-semibold text-slate-500">{sf.label}</th>
              ))}
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((item, rowIndex) => (
              <tr key={item.id} className="border-t border-slate-100">
                {(field.subFields || []).map(sf => (
                  <td key={sf.id} className="p-1">
                    {sf.type === 'CURRENCY' || sf.type === 'NUMBER' || sf.type === 'PERCENT' ? (
                      <input
                        {...register(`${field.id}.${rowIndex}.${sf.id}`, { valueAsNumber: true })}
                        placeholder={sf.label}
                        className="w-full border p-1 rounded text-xs"
                        type="number"
                        step="any"
                      />
                    ) : (
                      <input
                        {...register(`${field.id}.${rowIndex}.${sf.id}`)}
                        placeholder={sf.label}
                        className="w-full border p-1 rounded text-xs"
                      />
                    )}
                  </td>
                ))}
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => remove(rowIndex)}
                    className="text-rose-400 hover:text-rose-600 p-1 transition"
                    title="Xóa dòng"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-red-500 text-xs">{error.message}</p>}
    </div>
  );
}
