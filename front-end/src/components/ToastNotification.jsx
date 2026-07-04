import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onClose]);

  const Icon = toast.type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{toast.title}</div>
          {toast.message ? <div className="mt-1 text-sm opacity-90">{toast.message}</div> : null}
        </div>
        <button type="button" onClick={() => onClose(toast.id)} className="rounded-full p-1 transition hover:bg-black/5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function ToastNotification({ toasts, onClose }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
