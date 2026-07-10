/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePushNotification } from '../../hooks/usePushNotification.js';
import { notify } from '../../utils/notify.jsx';
import { Bell, BellRing, Smartphone, Check, X, Loader2, Send } from 'lucide-react';
import api from '../../utils/api.js';

const STATUS_OPTIONS = [
  { key: 'pending_loading', label: 'Chờ phân xe', desc: 'Đơn mới tạo, chờ phân phương tiện' },
  { key: 'assigned', label: 'Đã phân xe', desc: 'Đã có xe đến lấy hàng' },
  { key: 'delivering', label: 'Đang giao hàng', desc: 'Hàng đang trên đường giao' },
  { key: 'completed', label: 'Đã xuất kho', desc: 'Đơn hoàn thành xuất kho' }
];

export default function NotificationSettings() {
  const { activeCompany } = useAuth();
  const {
    isSupported,
    permission,
    subscription,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe
  } = usePushNotification();

  const [enabled, setEnabled] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(STATUS_OPTIONS.map(s => s.key));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(subscription) || permission === 'granted');
  }, [subscription, permission]);

  const handleToggle = async (next) => {
    if (!isSupported) {
      notify.warning('Trình duyệt của bạn không hỗ trợ thông báo đẩy (Web Push).');
      return;
    }
    if (next) {
      setSaving(true);
      try {
        const perm = await requestPermission();
        if (!perm.success) {
          notify.error(perm.error || 'Không thể cấp quyền thông báo.');
          return;
        }
        const companyId = activeCompany?.id ?? activeCompany;
        const res = await subscribe(companyId);
        if (res.success) {
          setEnabled(true);
          notify.success('Đã bật thông báo đẩy trạng thái đơn hàng!');
        } else {
          notify.error(res.error || 'Đăng ký push thất bại.');
        }
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      try {
        await unsubscribe();
        setEnabled(false);
        notify.info('Đã tắt thông báo đẩy.');
      } catch (err) {
        notify.error(err.error || 'Hủy đăng ký thất bại.');
      } finally {
        setSaving(false);
      }
    }
  };

  const toggleStatus = (key) => {
    setSelectedStatuses(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const sendTest = async () => {
    const companyId = activeCompany?.id ?? activeCompany;
    if (!companyId) return;
    try {
      await api.post('/notifications/send', {
        company_id: companyId,
        type: 'order',
        title: 'Thông báo thử nghiệm',
        message: 'Đây là thông báo test trạng thái đơn hàng từ hệ thống.',
        recipientRole: 'admin'
      });
      notify.success('Đã gửi thông báo test. Kiểm tra OS Notification góc màn hình!');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Gửi test thất bại.');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BellRing size={22} className="text-indigo-600" />
          Cài Đặt Thông Báo Đẩy (OS Notification)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Nhận thông báo trạng thái đơn hàng trực tiếp trên hệ điều hành (Windows / macOS / Android / iOS)
        </p>
      </div>

      {/* Trạng thái trình duyệt */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              {enabled ? <BellRing size={20} /> : <Bell size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Thông báo đẩy đơn hàng</p>
              <p className="text-xs text-slate-400">
                {!isSupported
                  ? 'Trình duyệt không hỗ trợ'
                  : permission === 'denied'
                  ? 'Đã bị chặn — vào cài đặt trình duyệt để bật lại'
                  : enabled
                  ? 'Đang bật — bạn sẽ nhận OS Notification'
                  : 'Đang tắt'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle(!enabled)}
            disabled={isLoading || saving || !isSupported || permission === 'denied'}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              enabled ? 'bg-emerald-500' : 'bg-slate-300'
            } disabled:opacity-50`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {!isSupported && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠️ Web Push yêu cầu trình duyệt hỗ trợ Service Worker + HTTPS (localhost cũng được).
          </div>
        )}
      </div>

      {/* Chọn trạng thái đơn hàng nhận thông báo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-bold text-slate-800 mb-3">Nhận thông báo khi đơn hàng chuyển sang:</p>
        <div className="space-y-2">
          {STATUS_OPTIONS.map(opt => {
            const checked = selectedStatuses.includes(opt.key);
            return (
              <label
                key={opt.key}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStatus(opt.key)}
                  className="hidden"
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                  checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                }`}>
                  {checked && <Check size={14} className="text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Nút test */}
      <div className="flex items-center gap-3">
        <button
          onClick={sendTest}
          disabled={!enabled}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Gửi thông báo thử nghiệm
        </button>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Smartphone size={14} /> Sẽ hiện popup hệ điều hành góc màn hình
        </span>
      </div>

      {/* Hướng dẫn mobile */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-600">Lưu ý thiết bị:</p>
        <p>• <strong>Android:</strong> Nhận trực tiếp qua Chrome/Edge.</p>
        <p>• <strong>iOS:</strong> Safari 16.4+ → Thêm app vào màn hình chờ (Add to Home Screen) để nhận Push.</p>
        <p>• <strong>Desktop:</strong> Windows Action Center / macOS Notification Center.</p>
      </div>
    </div>
  );
}