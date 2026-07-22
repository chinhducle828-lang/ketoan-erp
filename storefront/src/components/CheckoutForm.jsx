/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState } from 'react';
import { formatPrice, getUnitPrice, getOrderAmount, getUnitPriceWithTax } from '../utils/formatters.js';
import { createOrder } from '../utils/api';

const VAT_RATE = 0.08;

const CheckoutForm = ({
  cart,
  onClearCart,
  selectedCurrency,
  t,
  companyId,
  onOrderSuccess,
  taxRate = 0.08
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price_sell) || 0) * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const totalWithTax = Math.max(0, (subtotal * (1 + taxRate)) - discount);

  const applyCoupon = () => {
    if (coupon === 'SAVE10') {
      setDiscount(subtotal * 0.1);
    } else {
      setDiscount(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cart.length) return;

    if (!agreedToTerms) {
      setShowConsentError(true);
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const orderPayload = {
        companyId: Number(companyId),
        items: cart.map((item) => ({
          itemId: item.id,
          quantity: item.quantity,
          unitPrice: getUnitPrice(item)
        })),
        customerName,
        phone,
        address,
        amount: totalWithTax,
        taxRate: taxRate
      };

      const result = await createOrder(orderPayload);
setMessage(`Đặt hàng thành công. Mã chứng từ: ${result?.voucherNumber || result?.id || 'N/A'}`);
      onClearCart();
      setCustomerName('');
      setPhone('');
      setAddress('');
      setCoupon('');
      setDiscount(0);
      
      if (onOrderSuccess) {
        onOrderSuccess(result);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Có lỗi xảy ra khi đặt hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length) {
    return (
      <div className="p-4 text-center text-slate-500">
        {t('selectProduct', 'VI')}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <h3 className="text-lg font-semibold text-slate-900">{t('checkout', 'VI')}</h3>
      
      <div>
        <label className="block text-sm font-medium text-slate-700">{t('customerName', 'VI')}</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">{t('phone', 'VI')}</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">{t('address', 'VI')}</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          rows={2}
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex justify-between text-sm">
          <span>{t('subtotal', 'VI')}</span>
          <span>{formatPrice(subtotal, selectedCurrency)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-rose-600">
            <span>{t('discount', 'VI')}</span>
            <span>-{formatPrice(discount, selectedCurrency)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-slate-500">
          <span>Thuế VAT {(taxRate * 100).toFixed(0)}%</span>
          <span>{formatPrice(subtotal * taxRate - discount * taxRate, selectedCurrency)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-indigo-600 mt-1">
          <span>Tổng thanh toán</span>
          <span>{formatPrice(totalWithTax, selectedCurrency)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">{t('coupon', 'VI')}</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="SAVE10"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
          />
          <button
            type="button"
            onClick={applyCoupon}
            className="btn-balanced-secondary"
          >
            {t('apply', 'VI')}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 disabled:opacity-50"
      >
        {submitting ? t('processing', 'VI') : t('checkout', 'VI')}
      </button>

      {message && (
        <p className={`text-center text-sm ${message.includes('thành công') ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default CheckoutForm;