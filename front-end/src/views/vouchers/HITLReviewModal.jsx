/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * HITLReviewModal - Modal duyệt AI proposal
 * Hiển thị so sánh đề xuất AI vs đã duyệt
 */

import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import api from '../../utils/api.js';

const STATUS_CONFIG = {
  AUTO_POSTED: { label: 'Tự động', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  HUMAN_REVIEW: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  EXPERT_AUDIT: { label: 'Cần KT', color: 'bg-rose-100 text-rose-700', icon: TrendingUp }
};

export default function HITLReviewModal({ 
  isOpen, 
  onClose, 
  voucher, 
  onApprove, 
  onReject 
}) {
  const [activeTab, setActiveTab] = useState('original');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !voucher) return null;

  const statusConfig = STATUS_CONFIG[voucher.hitl_status] || STATUS_CONFIG.HUMAN_REVIEW;
  const StatusIcon = statusConfig.icon;

  const formatAmount = (amount) => {
    return Math.round(amount || 0)?.toLocaleString('vi-VN');
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const result = await api.put(`/hitl/logs/${voucher.hitl_log_id}/approve`, {
        status: 'approved'
      });
      onApprove && onApprove(voucher.id);
      onClose();
    } catch (err) {
      alert('Lỗi duyệt chứng từ: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const result = await api.put(`/hitl/logs/${voucher.hitl_log_id}/approve`, {
        status: 'rejected'
      });
      onReject && onReject(voucher.id);
      onClose();
    } catch (err) {
      alert('Lỗi từ chối chứng từ: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Duyệt Chứng Từ Đề Xuất Bởi AI
              </h2>
              <p className="text-sm text-slate-500">
                #{voucher.voucherNumber} - {voucher.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Confidence Score & Status */}
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-500">Độ tin cậy AI</p>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      voucher.ai_confidence_score >= 95 ? 'bg-emerald-500' :
                      voucher.ai_confidence_score >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${voucher.ai_confidence_score || 0}%` }}
                  />
                </div>
                <span className="text-sm font-bold">
                  {(voucher.ai_confidence_score || 0).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trạng thái</p>
              <span className={`px-2 py-1 rounded text-xs font-bold ${statusConfig.color}`}>
                <StatusIcon size={12} className="inline mr-1" />
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('original')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'original' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-500'
            }`}
          >
            Hóa đơn gốc
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'ai' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-500'
            }`}
          >
            Đề xuất AI
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'approved' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-slate-500'
            }`}
          >
            Đã duyệt
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'original' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Xem trước hóa đơn gốc (PDF/Ảnh)
              </p>
              <div className="border rounded-lg p-4 bg-slate-50 min-h-[200px] flex items-center justify-center">
                <p className="text-slate-400">Tính năng xem PDF sẽ được triển khai</p>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">
                Đề xuất định khoản từ AI:
              </p>
              <div className="border rounded-lg p-4 bg-slate-50">
                {voucher.original_ai_proposal?.entries?.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <span className={`font-bold text-xs ${
                      entry.entryType === 'DR' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {entry.entryType === 'DR' ? 'Nợ' : 'Có'}
                    </span>
                    <span className="font-mono text-sm">{entry.accountCode}</span>
                    <span className="text-slate-600">{entry.description}</span>
                    <span className="ml-auto font-mono font-bold">
                      {formatAmount(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'approved' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">
                Định khoản sau khi duyệt:
              </p>
              <div className="border rounded-lg p-4 bg-emerald-50">
                {voucher.final_human_approved?.entries?.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-4 py-2 border-b last:border-0">
                    <span className={`font-bold text-xs ${
                      entry.entryType === 'DR' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {entry.entryType === 'DR' ? 'Nợ' : 'Có'}
                    </span>
                    <span className="font-mono text-sm">{entry.accountCode}</span>
                    <span className="text-slate-600">{entry.description}</span>
                    <span className="ml-auto font-mono font-bold">
                      {formatAmount(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            Hủy [Esc]
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-bold hover:bg-rose-200"
          >
            Từ chối
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            Duyệt nhanh [Space]
          </button>
        </div>
      </div>
    </div>
  );
}