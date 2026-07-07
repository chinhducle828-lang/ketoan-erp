import React from 'react';
import { ShoppingCart, X, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { getUnitPriceWithTax } from '../utils/formatters';

/**
 * Floating Action Bar for Mobile Cart
 * Provides persistent cart summary and checkout CTA at bottom of viewport
 * Implements 44px minimum touch targets for mobile ergonomics
 */
export default function FloatingCartBar({ 
  cart, 
  onUpdateQuantity, 
  onRemoveItem, 
  onCheckout, 
  onClose,
  subtotal,
  itemCount 
}) {
  if (cart.length === 0) return null;

  return (
    <div className="floating-action-bar md:hidden">
      <div className="max-w-[1180px] mx-auto px-3 py-2.5">
        {/* Cart Summary */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <ShoppingCart size={20} className="text-indigo-600" />
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Tổng thanh toán</span>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 text-slate-400 hover:text-slate-600"
            title="Đóng giỏ hàng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold text-indigo-600">
            {subtotal.toLocaleString('vi-VN')}đ
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">Đã bao gồm Thuế VAT 8%</span>
        </div>

        {/* Cart Items Preview */}
        <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
          {cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                <p className="text-[10px] text-slate-500">
                  {getUnitPriceWithTax(item).toLocaleString('vi-VN')}đ x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  className="touch-target p-1 rounded-lg hover:bg-slate-200 transition"
                  title="Giảm số lượng"
                >
                  <Minus size={16} />
                </button>
                <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  className="touch-target p-1 rounded-lg hover:bg-slate-200 transition"
                  title="Tăng số lượng"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="touch-target p-1 rounded-lg hover:bg-rose-50 text-rose-500 transition"
                  title="Xóa khỏi giỏ"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Button */}
        <button
          onClick={onCheckout}
          className="w-full btn-balanced-primary"
        >
          <span>Tiến hành đặt hàng</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}