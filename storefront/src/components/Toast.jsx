import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { TOAST_DEFAULTS, ANIMATION } from '../../constants/storefront';

/**
 * Toast Notification Component
 * Provides non-intrusive feedback for user actions
 * Replaces native alert() calls with polished UI
 * 
 * @param {Object} toast - Toast configuration
 * @param {string} toast.type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} toast.message - Message to display
 * @param {number} toast.duration - Auto-dismiss duration in ms (default: from constants)
 * @param {Function} onDismiss - Callback when toast is dismissed
 */
export default function Toast({ toast, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!toast) return;

    setIsVisible(true);

    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.duration || TOAST_DEFAULTS.DURATION);

    return () => clearTimeout(timer);
  }, [toast]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsLeaving(false);
      onDismiss?.();
    }, ANIMATION.TOAST_EXIT);
  };

  if (!toast || !isVisible) return null;

  const icons = {
    success: <CheckCircle2 size={20} className="text-emerald-600" />,
    error: <XCircle size={20} className="text-red-600" />,
    warning: <AlertCircle size={20} className="text-amber-600" />,
    info: <Info size={20} className="text-blue-600" />
  };

  const backgrounds = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200'
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full ${backgrounds[toast.type]} border rounded-lg shadow-lg p-4 transition-all duration-300 ${
        isLeaving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {toast.title || (toast.type === 'success' ? 'Thành công' : 
                             toast.type === 'error' ? 'Lỗi' : 
                             toast.type === 'warning' ? 'Cảnh báo' : 'Thông tin')}
          </p>
          {toast.message && (
            <p className="text-xs text-slate-600 mt-1">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="touch-target flex-shrink-0 p-1 rounded-lg hover:bg-slate-200/50 transition"
          title="Đóng"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>
    </div>
  );
}

/**
 * Toast Manager Hook
 * Manages multiple toasts with queue system
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const success = (message, title, duration) => {
    return addToast({ type: 'success', message, title, duration });
  };

  const error = (message, title, duration) => {
    return addToast({ type: 'error', message, title, duration });
  };

  const warning = (message, title, duration) => {
    return addToast({ type: 'warning', message, title, duration });
  };

  const info = (message, title, duration) => {
    return addToast({ type: 'info', message, title, duration });
  };

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
}

/**
 * Toast Container Component
 * Renders all active toasts
 */
export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}