/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api.js';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { ShoppingCart, Package, Phone, MapPin, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: getDefaultCurrency(),
    minimumFractionDigits: 0
  }).format(value || 0);
};

const formatTaxRate = (rate) => {
  return `${Math.round((rate || 0) * 100)}%`;
};

export default function StorefrontOrder() {
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState({});
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Lấy companyId từ URL query hoặc input
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('company_id');
    if (cid) setCompanyId(cid);
  }, []);

  // Load items khi có companyId
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    api.get(`/public/items?company_id=${companyId}`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setItems(res.data);
        } else {
          setItems([]);
        }
      })
      .catch((err) => {
        setError('Không thể tải danh sách sản phẩm: ' + (err.response?.data?.error || err.message));
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const toggleCart = (itemId) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const updateQuantity = (itemId, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    setCart((prev) => ({ ...prev, [itemId]: q }));
  };

  const cartItems = items.filter((item) => cart[item.id]);
  const totalNet = cartItems.reduce((sum, item) => sum + (Number(item.price_sell || 0) * cart[item.id]), 0);

  const handleSubmit = async () => {
    if (!companyId || cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        companyId: Number(companyId),
        items: cartItems.map((item) => ({
          itemId: String(item.id),
          quantity: cart[item.id]
        })),
        customerName: customerName || 'Khách lẻ',
        phone: phone || '',
        address: address || ''
      };

      const response = await api.post('/public/orders', payload);
      setResult(response.data);
      setCart({});
      setCustomerName('');
      setPhone('');
      setAddress('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Có lỗi xảy ra khi đặt hàng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 flex items-center justify-center gap-3">
            <ShoppingCart className="text-blue-600" size={32} />
            CỬA HÀNG TRỰC TUYẾN
          </h1>
          <p className="text-sm text-slate-500 mt-1">Chọn sản phẩm và đặt hàng</p>
        </div>

        {/* Company ID Input */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <label className="block text-xs font-bold text-slate-600 mb-1">Mã doanh nghiệp (Company ID)</label>
          <input
            type="number"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder="Nhập company_id..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 flex items-center gap-2 text-rose-700 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        {/* Danh sách sản phẩm */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {items.map((item) => {
              const inCart = cart[item.id] > 0;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm p-4 transition-all cursor-pointer ${
                    inCart ? 'border-blue-500 shadow-blue-100' : 'border-slate-200 hover:border-blue-200'
                  }`}
                  onClick={() => toggleCart(item.id)}
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-40 object-cover rounded-xl mb-3"
                    />
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                      {item.code && <p className="text-[10px] text-slate-400">{item.code}</p>}
                    </div>
                    <span className="text-lg font-black text-blue-600">
                      {formatCurrency(item.price_sell)}
                    </span>
                  </div>
                  {item.unit && <p className="text-[10px] text-slate-400 mt-1">Đơn vị: {item.unit}</p>}

                  {inCart && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500">Số lượng:</label>
                      <input
                        type="number"
                        min="1"
                        value={cart[item.id]}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateQuantity(item.id, e.target.value);
                        }}
                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center font-bold mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Thành tiền: <span className="font-bold text-slate-800">{formatCurrency(Number(item.price_sell || 0) * cart[item.id])}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Giỏ hàng & Thanh toán */}
        {cartItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              Giỏ hàng ({cartItems.length} sản phẩm)
            </h2>

            {/* Thông tin khách hàng */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tên khách hàng"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Số điện thoại"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Danh sách sản phẩm trong giỏ */}
            <div className="divide-y divide-slate-100 mb-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {formatCurrency(item.price_sell)} × {cart[item.id]} {item.unit || ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(Number(item.price_sell || 0) * cart[item.id])}
                  </p>
                </div>
              ))}
            </div>

            {/* ----- HIỂN THỊ GIÁ: NET / TAX / GROSS ----- */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1 border border-slate-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Thành tiền (Giá gốc - Net):</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalNet)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Thuế suất áp dụng:</span>
                <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">
                  {formatTaxRate(0.08)} (mặc định bán lẻ)
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Thuế (Tax):</span>
                <span className="font-bold text-amber-600">{formatCurrency(Math.round(totalNet * 0.08))}</span>
              </div>
              <div className="flex justify-between items-center text-base pt-2 mt-2 border-t border-slate-200">
                <span className="font-black text-slate-900">TỔNG THANH TOÁN (Gross):</span>
                <span className="text-xl font-black text-blue-600">{formatCurrency(Math.round(totalNet * 1.08))}</span>
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1">
                * Thuế được tính toán dựa trên loại pháp nhân, doanh thu và ngành hàng của doanh nghiệp.
                Backend sẽ quyết định thuế suất chính xác khi đơn hàng được tạo.
              </p>
            </div>

            {/* Nút đặt hàng */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
              ) : (
                <><ShoppingCart size={16} /> ĐẶT HÀNG NGAY</>
              )}
            </button>
          </div>
        )}

        {/* Kết quả đặt hàng thành công */}
        {result && (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 text-emerald-700 mb-3">
              <CheckCircle size={24} />
              <h2 className="text-lg font-black">ĐẶT HÀNG THÀNH CÔNG</h2>
            </div>
            <div className="bg-white rounded-xl p-4 space-y-2 text-sm border border-emerald-100">
              <p><span className="font-bold text-slate-600">Mã đơn:</span> <span className="font-bold text-blue-600">{result.voucherNumber}</span></p>
              <p><span className="font-bold text-slate-600">Tiền hàng (Net):</span> {formatCurrency(result.order?.netAmount)}</p>
              <p><span className="font-bold text-slate-600">Thuế:</span> <span className="text-amber-600">{formatCurrency(result.order?.taxAmount)}</span></p>
              <p><span className="font-bold text-slate-600">Tổng thanh toán (Gross):</span> <span className="text-lg font-black text-emerald-600">{formatCurrency(result.order?.amount)}</span></p>
              {result.order?.items && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="font-bold text-slate-600 mb-1">Sản phẩm:</p>
                  {result.order.items.map((line, idx) => (
                    <p key={idx} className="text-xs text-slate-500">
                      {line.name} × {line.quantity} — {formatCurrency(line.amount)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}