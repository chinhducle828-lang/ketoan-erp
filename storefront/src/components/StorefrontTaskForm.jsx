/**
 * StorefrontTaskForm.jsx - Task-Oriented Form cho Storefront
 * Simplified form cho guest checkout, product creation, order completion
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useRef, useEffect } from 'react';
import { useStorefrontIdempotency } from '../hooks/useStorefrontIdempotency';
import { notify } from '../utils/notify';
import { publicApi, authApi } from '../utils/api';

/**
 * StorefrontTaskForm - Form đơn giản cho storefront operations
 * 
 * @param {string} eventType - Loại nghiệp vụ ('sale', 'simple_purchase', 'sales_credit')
 * @param {Function} onSuccess - Callback khi thành công
 * @param {Function} onError - Callback khi lỗi
 * @param {Object} extraData - Dữ liệu thêm (companyId, storefrontToken, ...)
 */
export default function StorefrontTaskForm({
  eventType,
  onSuccess,
  onError,
  extraData = {},
  ...props
}) {
  const [submitting, setSubmitting] = useState(false);
  const { generateIdempotencyKey, withIdempotency, cleanup } = useStorefrontIdempotency();
  
  // Generate idempotency key once per component mount
  const idempotencyKey = useRef(generateIdempotencyKey());
  
  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);
  
  /**
   * Submit handler với idempotency protection
   */
  const handleSubmit = withIdempotency(async (formData) => {
    setSubmitting(true);
    
    try {
      // Build payload based on eventType
      const payload = {
        entityType: eventType,
        company_id: extraData.companyId,
        ...formData,
        ...extraData,
        // Storefront-specific fields
        sales_channel: 'storefront',
        idempotency_key: idempotencyKey.current
      };
      
      // Call REA Event API
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey.current
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        notify.success(`Đơn hàng đã được tạo!`);
        
        // Call success callback
        if (onSuccess) {
          onSuccess(result.data);
        }
        
        // Generate new key for next submission
        idempotencyKey.current = generateIdempotencyKey();
        
        return result.data;
      } else {
        // Handle specific error cases
        if (result.status === 'FROZEN') {
          // Credit Freeze - show warning
          notify.warning('Đơn hàng bị khóa do vượt hạn mức công nợ.');
        } else if (result.status === 'REJECTED') {
          notify.error(result.error || 'Đơn hàng bị từ chối.');
        } else {
          notify.error(result.error || 'Lỗi tạo đơn hàng');
        }
        
        // Call error callback
        if (onError) {
          onError(result);
        }
        
        throw new Error(result.error || 'Failed to create order');
      }
    } catch (err) {
      const errorMessage = err.message || 'Lỗi kết nối đến hệ thống';
      notify.error(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, idempotencyKey.current);
  
  // Determine button state
  const isDisabled = submitting;
  const buttonText = submitting ? 'Đang xử lý...' : 'Xác nhận';
  
  return (
    <div className="storefront-task-form">
      {/* Render form fields based on eventType */}
      {renderFormFields(eventType, props)}
      
      {/* Submit button */}
      <button
        type="button"
        onClick={() => handleSubmit(props.formData)}
        disabled={isDisabled}
        className={`
          w-full font-bold py-3 px-4 rounded-xl transition-all duration-200
          ${isDisabled 
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg'
          }
        `}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg 
              className="animate-spin h-5 w-5" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" 
              />
            </svg>
            Đang xử lý...
          </span>
        ) : (
          buttonText
        )}
      </button>
    </div>
  );
}

/**
 * Render form fields based on eventType
 * Simplified version cho storefront
 */
function renderFormFields(eventType, props) {
  switch (eventType) {
    case 'sale':
      return <GuestCheckoutFields {...props} />;
    case 'simple_purchase':
      return <ProductCreationFields {...props} />;
    case 'sales_credit':
      return <OrderCompletionFields {...props} />;
    default:
      return <div>Form không hỗ trợ: {eventType}</div>;
  }
}

/**
 * Guest Checkout Fields - Cho khách mua hàng
 */
function GuestCheckoutFields({ formData, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Họ tên <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.customerName || ''}
          onChange={(e) => onChange('customerName', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Nhập họ tên"
          required
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Số điện thoại <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => onChange('phone', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Nhập SĐT"
          required
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Địa chỉ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.address || ''}
          onChange={(e) => onChange('address', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Nhập địa chỉ"
          required
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Phương thức thanh toán
        </label>
        <select
          value={formData.paymentMethod || 'cod'}
          onChange={(e) => onChange('paymentMethod', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="cod">Tiền mặt (COD)</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="casso">Casso</option>
        </select>
      </div>
    </div>
  );
}

/**
 * Product Creation Fields - Cho admin tạo sản phẩm
 */
function ProductCreationFields({ formData, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Mã sản phẩm <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.code || ''}
          onChange={(e) => onChange('code', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="VD: SP001"
          required
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Tên sản phẩm <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Nhập tên sản phẩm"
          required
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Đơn vị tính
        </label>
        <input
          type="text"
          value={formData.unit || ''}
          onChange={(e) => onChange('unit', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="VD: cái, hộp, kg"
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Giá bán (VND)
        </label>
        <input
          type="number"
          value={formData.price_sell || ''}
          onChange={(e) => onChange('price_sell', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="0"
          min="0"
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Số lượng tồn kho ban đầu
        </label>
        <input
          type="number"
          value={formData.opening_quantity || ''}
          onChange={(e) => onChange('opening_quantity', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="0"
          min="0"
        />
      </div>
    </div>
  );
}

/**
 * Order Completion Fields - Cho kho xác nhận hoàn thành
 */
function OrderCompletionFields({ formData, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Mã đơn hàng
        </label>
        <input
          type="text"
          value={formData.voucherNumber || ''}
          onChange={(e) => onChange('voucherNumber', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="VD: ORD-001"
          readOnly
        />
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Trạng thái
        </label>
        <select
          value={formData.status || 'completed'}
          onChange={(e) => onChange('status', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="completed">Hoàn thành</option>
          <option value="shipped">Đã giao</option>
        </select>
      </div>
      
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Ghi chú
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => onChange('notes', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Ghi chú (nếu có)"
          rows={3}
        />
      </div>
    </div>
  );
}