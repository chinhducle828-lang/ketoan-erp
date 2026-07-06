import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { STOCK_THRESHOLDS, UI_TEXT } from '../constants/storefront';

/**
 * Visual Stock Indicator Component
 * Displays stock levels with intuitive color-coded badges
 * 
 * @param {number} quantity - Current stock quantity
 * @param {string} unit - Unit of measurement (optional)
 * @param {number} lowStockThreshold - Threshold for low stock warning (default: from constants)
 */
export default function StockIndicator({ 
  quantity = 0, 
  unit = UI_TEXT.VI.UNIT_DEFAULT,
  lowStockThreshold = STOCK_THRESHOLDS.LOW_STOCK_DEFAULT 
}) {
  const isLowStock = quantity <= lowStockThreshold;
  const isOutOfStock = quantity === 0;

  if (isOutOfStock) {
    return (
      <div className="flex items-center gap-1 text-red-600 font-semibold">
        <AlertTriangle size={14} />
        <span className="text-xs">{UI_TEXT.VI.STOCK_OUT}</span>
      </div>
    );
  }

  if (isLowStock) {
    return (
        <div className="stock-low flex items-center gap-1">
        <AlertTriangle size={14} />
        <span className="text-xs">
          {UI_TEXT.VI.STOCK_LOW} {quantity.toLocaleString('vi-VN')} {unit}
        </span>
      </div>
    );
  }

  return (
    <div className="stock-high flex items-center gap-1">
      <Package size={14} />
      <span className="text-xs">
        {UI_TEXT.VI.STOCK_HIGH} {quantity.toLocaleString('vi-VN')} {unit}
      </span>
    </div>
  );
}