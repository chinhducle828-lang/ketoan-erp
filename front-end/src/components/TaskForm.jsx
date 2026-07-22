/**
 * TaskForm.jsx - Task-Oriented Form wrapper
 * Wrapper cho DynamicForm với:
 * - Auto-generated Idempotency-Key
 * - Stateful button (loading/disabled)
 * - Event-specific validation
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useRef, useEffect } from 'react';
import { useIdempotency } from '../hooks/useIdempotency';
import { notify } from '../utils/notify';
import DynamicForm from '../core/DynamicForm';

/**
 * TaskForm - Form động hướng tác vụ cho REA Event System
 * 
 * @param {string} eventType - Loại nghiệp vụ ('simple_purchase', 'sale', ...)
 * @param {Function} onSuccess - Callback khi thành công
 * @param {Function} onError - Callback khi lỗi
 * @param {string} submitButtonText - Text cho nút submit
 * @param {boolean} disabled - Disable form
 * @param {string} idempotencyKey - Idempotency key (auto-generated nếu không có)
 * @param {Object} extraData - Dữ liệu thêm gắn vào payload
 */
export default function TaskForm({
  eventType,
  onSuccess,
  onError,
  submitButtonText = 'Lưu',
  disabled = false,
  idempotencyKey: propIdempotencyKey,
  extraData = {},
  ...props
}) {
  const [submitting, setSubmitting] = useState(false);
  const { generateIdempotencyKey, withIdempotency, cleanup } = useIdempotency();
  
  // Generate idempotency key once per component mount
  const idempotencyKey = useRef(propIdempotencyKey || generateIdempotencyKey());
  
  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);
  
  /**
   * Submit handler với idempotency protection
   */
  const handleSubmit = withIdempotency(async (data) => {
    setSubmitting(true);
    
    try {
      // Build payload
      const payload = {
        entityType: eventType,
        company_id: data.company_id || extraData.company_id,
        ...data,
        ...extraData,
        // Attach idempotency key to payload (backend sẽ dùng)
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
        notify.success(`Nghiệp vụ ${eventType} thành công!`);
        
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
          // Credit Freeze - không phải lỗi thực sự
          notify.warning('Đơn hàng đã bị khóa bởi hệ thống quản lý rủi ro.');
        } else if (result.status === 'REJECTED') {
          notify.error(result.error || 'Nghiệp vụ bị từ chối.');
        } else {
          notify.error(result.error || 'Lỗi xử lý nghiệp vụ');
        }
        
        // Call error callback
        if (onError) {
          onError(result);
        }
        
        throw new Error(result.error || 'Failed to process event');
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
  const isDisabled = disabled || submitting;
  const buttonText = submitting ? 'Đang xử lý...' : submitButtonText;
  
  return (
    <div className="task-form-wrapper">
      <DynamicForm
        entityType={eventType}
        onSubmit={handleSubmit}
        {...props}
      />
      
      {/* Custom submit button with idempotency state */}
      {props.showSubmitButton !== false && (
        <div className="mt-6">
          <button
            type="submit"
            form={props.formId || `task-form-${eventType}`}
            disabled={isDisabled}
            className={`
              w-full font-bold py-3 px-4 rounded-xl transition-all duration-200
              ${isDisabled 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
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
          
          {/* Idempotency indicator (debug mode) */}
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-2 text-[10px] text-slate-400 font-mono">
              Idempotency Key: {idempotencyKey.current.substring(0, 8)}...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Higher-Order Component để wrap existing forms với idempotency
 * 
 * @param {React.Component} WrappedComponent - Component cần wrap
 * @param {string} eventType - Event type
 * @returns {React.Component} Component với idempotency
 */
export function withTaskForm(WrappedComponent, eventType) {
  return function TaskFormWrapper(props) {
    const { generateIdempotencyKey, withIdempotency } = useIdempotency();
    const [submitting, setSubmitting] = useState(false);
    const idempotencyKey = useRef(generateIdempotencyKey());
    
    const handleSubmit = withIdempotency(async (data) => {
      setSubmitting(true);
      try {
        const result = await WrappedComponent.submit(data, {
          idempotencyKey: idempotencyKey.current,
          eventType
        });
        return result;
      } finally {
        setSubmitting(false);
      }
    }, idempotencyKey.current);
    
    return (
      <WrappedComponent
        {...props}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    );
  };
}