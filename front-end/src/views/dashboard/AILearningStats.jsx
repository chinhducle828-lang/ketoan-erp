/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * AILearningStats - Thống kê độ chính xác AI
 * Hiển thị tỷ lệ học và cải thiện AI qua thời gian
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Brain, Target, BarChart3 } from 'lucide-react';
import api from '../../utils/api.js';

export default function AILearningStats({ companyId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchStats();
    }
  }, [companyId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hitl/stats?company_id=${companyId}`);
      setStats(response.data);
    } catch (err) {
      console.error('Lỗi lấy thống kê AI:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-slate-200 rounded"></div>
            <div className="h-20 bg-slate-200 rounded"></div>
            <div className="h-20 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <p className="text-slate-500 text-center">Chưa có dữ liệu AI learning</p>
      </div>
    );
  }

  const accuracyRate = parseFloat(stats.accuracyRate) || 0;
  const isImproving = accuracyRate >= 90;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Brain size={20} className="text-indigo-600" />
          AI Learning Stats
        </h3>
        <span className={`text-xs px-2 py-1 rounded ${
          isImproving ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isImproving ? 'Đang cải thiện' : 'Cần cải thiện'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Tổng đề xuất */}
        <div className="text-center">
          <p className="text-xs text-slate-500">Tổng đề xuất</p>
          <p className="text-2xl font-bold text-slate-800">
            {stats.totalProposals}
          </p>
        </div>

        {/* Số lần sửa */}
        <div className="text-center">
          <p className="text-xs text-slate-500">Số lần sửa</p>
          <p className="text-2xl font-bold text-amber-600">
            {stats.modifiedCount}
          </p>
        </div>

        {/* Độ chính xác */}
        <div className="text-center">
          <p className="text-xs text-slate-500">Độ chính xác</p>
          <div className="flex items-center justify-center gap-1">
            <p className={`text-2xl font-bold ${
              accuracyRate >= 90 ? 'text-emerald-600' : 
              accuracyRate >= 70 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {accuracyRate}%
            </p>
            {isImproving ? (
              <TrendingUp size={16} className="text-emerald-500" />
            ) : (
              <TrendingDown size={16} className="text-rose-500" />
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Tiến độ học</span>
          <span className="font-medium">{accuracyRate}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              accuracyRate >= 90 ? 'bg-emerald-500' :
              accuracyRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${accuracyRate}%` }}
          />
        </div>
      </div>

      {/* Thông tin chi tiết */}
      <div className="mt-4 pt-4 border-t text-xs text-slate-500">
        <div className="flex justify-between">
          <span>Trung bình confidence: {stats.avgConfidence?.toFixed(1) || 0}%</span>
          <span>Đã duyệt: {stats.approvedCount}</span>
        </div>
      </div>
    </div>
  );
}