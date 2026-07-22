/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';
import { Activity, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function EventStats({ stats }) {
  if (!stats) return null;

  const statCards = [
    {
      label: 'Tổng sự kiện',
      value: stats.total || 0,
      icon: Activity,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200'
    },
    {
      label: 'Đang xử lý',
      value: stats.processing || 0,
      icon: Loader,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      label: 'Hoàn thành',
      value: stats.completed || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200'
    },
    {
      label: 'Thất bại',
      value: stats.failed || 0,
      icon: XCircle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200'
    },
    {
      label: 'Chờ xử lý',
      value: stats.pending || 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`${stat.bgColor} ${stat.borderColor} border rounded-xl p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <Icon size={24} className={stat.color} />
            </div>
          </div>
        );
      })}
    </div>
  );
}