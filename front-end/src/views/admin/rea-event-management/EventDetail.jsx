/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';
import { X, Calendar, Clock, Hash, FileText, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function EventDetail({ event, onClose }) {
  if (!event) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={20} className="text-emerald-600" />;
      case 'FAILED':
        return <XCircle size={20} className="text-rose-600" />;
      case 'PROCESSING':
        return <Loader size={20} className="text-blue-600 animate-spin" />;
      case 'PENDING':
        return <Clock size={20} className="text-amber-600" />;
      default:
        return <AlertCircle size={20} className="text-slate-600" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      PROCESSING: { label: 'Đang xử lý', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      COMPLETED: { label: 'Hoàn thành', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      FAILED: { label: 'Thất bại', className: 'bg-rose-100 text-rose-700 border-rose-200' },
      RETRYING: { label: 'Đang thử lại', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
    return (
      <span className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderMetadata = () => {
    if (!event.metadata) return null;

    return (
      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Metadata</h4>
        <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words font-mono">
          {JSON.stringify(event.metadata, null, 2)}
        </pre>
      </div>
    );
  };

  const renderErrorDetails = () => {
    if (!event.error_message) return null;

    return (
      <div className="mt-4 p-4 bg-rose-50 rounded-lg border border-rose-200">
        <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-2">
          <AlertCircle size={14} /> Chi tiết lỗi
        </h4>
        <p className="text-sm text-rose-800 whitespace-pre-wrap break-words">{event.error_message}</p>
      </div>
    );
  };

  const renderAccountingEntries = () => {
    if (!event.accounting_entries || event.accounting_entries.length === 0) return null;

    return (
      <div className="mt-4">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
          Bút toán kế toán ({event.accounting_entries.length} dòng)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                <th className="p-2.5 border-r border-slate-200">Tài khoản</th>
                <th className="p-2.5 border-r border-slate-200">Tên tài khoản</th>
                <th className="p-2.5 border-r border-slate-200 text-right">Nợ</th>
                <th className="p-2.5 text-right">Có</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.accounting_entries.map((entry, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="p-2.5 border-r border-slate-100 font-mono">{entry.account_code}</td>
                  <td className="p-2.5 border-r border-slate-100 text-slate-700">{entry.account_name}</td>
                  <td className="p-2.5 border-r border-slate-100 text-right font-medium text-slate-700">
                    {entry.debit ? `${entry.debit.toLocaleString('vi-VN')}đ` : '--'}
                  </td>
                  <td className="p-2.5 text-right font-medium text-slate-700">
                    {entry.credit ? `${entry.credit.toLocaleString('vi-VN')}đ` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Chi tiết sự kiện</h2>
              <p className="text-xs text-slate-500 mt-0.5">Event #{event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(event.status)}
              {getStatusBadge(event.status)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Hash size={14} className="text-slate-500" />
                  <p className="text-xs text-slate-500 font-medium">Loại sự kiện</p>
                </div>
                <p className="text-sm font-bold text-slate-800 font-mono">{event.event_type}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-slate-500" />
                  <p className="text-xs text-slate-500 font-medium">Thời gian tạo</p>
                </div>
                <p className="text-sm font-bold text-slate-800">{formatDate(event.created_at)}</p>
              </div>

              {event.processed_at && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-slate-500" />
                    <p className="text-xs text-slate-500 font-medium">Thời gian xử lý</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{formatDate(event.processed_at)}</p>
                </div>
              )}

              {event.retry_count > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw size={14} className="text-slate-500" />
                    <p className="text-xs text-slate-500 font-medium">Số lần thử lại</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{event.retry_count} lần</p>
                </div>
              )}
            </div>

            {event.description && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-2">Mô tả</p>
                <p className="text-sm text-slate-800">{event.description}</p>
              </div>
            )}

            {renderAccountingEntries()}
            {renderMetadata()}
            {renderErrorDetails()}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}