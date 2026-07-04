import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, Minus, CreditCard, Package, ReceiptText, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import { showNotification, requestPermission } from '../../utils/notifications';
import ToastNotification from '../../components/ToastNotification';
import { useAuth } from '../../context/AuthContext';

export default function StorefrontAccessNotice() {
  const { activeCompany, user } = useAuth();
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const companyId = activeCompany?.id ? Number(activeCompany.id) : null;

  useEffect(() => {
    const loadItems = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/public/items', { params: { company_id: companyId } });
        setItems(Array.isArray(data) ? data : []);
      } catch (error) {
        setToasts((prev) => [...prev, { id: Date.now(), type: 'error', title: 'Lỗi tải sản phẩm', message: error.message }]);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [companyId]);

  useEffect(() => {
    requestPermission();
  }, []);

  const addToCart = (item) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry);
      }
      return [...current, { id: item.id, name: item.name, price: Number(item.price_sell || 0), quantity: 1 }];
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart((current) => current.flatMap((entry) => {
      if (entry.id !== itemId) return [entry];
      const nextQty = entry.quantity + delta;
      return nextQty > 0 ? [{ ...entry, quantity: nextQty }] : [];
    }));
  };

  const totalAmount = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const submitOrder = async () => {
    if (!companyId) {
      setToasts((prev) => [...prev, { id: Date.now(), type: 'error', title: 'Thiếu doanh nghiệp', message: 'Vui lòng chọn doanh nghiệp trước khi bán hàng.' }]);
      return;
    }

    if (!cart.length) {
      setToasts((prev) => [...prev, { id: Date.now(), type: 'error', title: 'Giỏ hàng trống', message: 'Hãy chọn ít nhất một sản phẩm.' }]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyId,
        customerName,
        items: cart.map((item) => ({ itemId: item.id, quantity: item.quantity }))
      };

      const { data } = await api.post('/public/orders', payload);
      const orderNumber = data?.voucherNumber || data?.order?.voucherNumber || 'Đơn mới';
      setToasts((prev) => [...prev, { id: Date.now(), type: 'success', title: 'Tạo đơn thành công', message: `${orderNumber} • Tổng ${totalAmount.toLocaleString('vi-VN')}đ` }]);
      await showNotification('Đơn bán hàng mới', `${orderNumber} đã được ghi nhận.`);
      await api.post('/pos/notify', {
        companyId,
        orderId: data?.voucherId || null,
        title: 'Đơn bán hàng mới',
        message: `Đơn ${orderNumber} đã được tạo bởi ${user?.fullName || user?.username || 'nhân viên'}`
      });
      setCart([]);
      setCustomerName('');
    } catch (error) {
      setToasts((prev) => [...prev, { id: Date.now(), type: 'error', title: 'Tạo đơn thất bại', message: error.message }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <ToastNotification toasts={toasts} onClose={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-slate-900">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <h1 className="text-xl font-semibold">Bán hàng tại quầy</h1>
              </div>
              <p className="text-sm text-slate-500">Chọn sản phẩm, tạo đơn và thanh toán nhanh trong một màn hình.</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {activeCompany?.name || 'Chưa chọn doanh nghiệp'}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sản phẩm</h2>
                <p className="text-sm text-slate-500">Danh sách đang có trong kho của doanh nghiệp.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{items.length} mục</div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Đang tải sản phẩm...</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => addToCart(item)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.code}</div>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                        {Number(item.price_sell || 0).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1"><Package className="h-4 w-4" />{item.unit || 'cái'}</span>
                      <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4" />Thêm vào giỏ</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Giỏ hàng & thanh toán</h2>
              <p className="text-sm text-slate-500">Kiểm tra đơn hàng trước khi ghi nhận.</p>
            </div>

            <label className="mb-3 block text-sm font-medium text-slate-700">
              Tên khách hàng
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Khách lẻ" />
            </label>

            <div className="space-y-2">
              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Giỏ hàng trống. Chọn sản phẩm để bắt đầu bán.</div>
              ) : cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.price.toLocaleString('vi-VN')}đ / sản phẩm</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)} className="rounded-full border border-slate-200 p-1 text-slate-600">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)} className="rounded-full border border-slate-200 p-1 text-slate-600">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Tổng tiền</span>
                <span>{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
              <button type="button" disabled={submitting} onClick={submitOrder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
                <CreditCard className="h-4 w-4" />
                {submitting ? 'Đang xử lý...' : 'Thanh toán'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <ReceiptText className="h-4 w-4" />
              Đơn sẽ được lưu vào hệ thống kế toán và gửi thông báo tới quản trị.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
