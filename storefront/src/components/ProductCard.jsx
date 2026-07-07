import React from 'react';
import { ShoppingCart, Heart, Eye, Package } from 'lucide-react';
import StockIndicator from './StockIndicator';
import { getUnitPriceWithTax } from '../utils/formatters';

/**
 * Compact Product Card Component for Storefront
 * Mobile-optimized with 44px touch targets and visual stock indicators
 */
export default function ProductCard({
  product,
  onAction,
  actionLabel = 'Thêm',
  actionClassName = 'btn-balanced-primary flex-1',
  onViewDetails,
  onSecondaryAction,
  isInWishlist = false,
  onToggleWishlist,
  secondaryLabel = 'Xem',
  secondaryClassName = 'btn-balanced-secondary flex-1'
}) {
  const unitPrice = Number(product?.price_sell) || 0;
  const stockQuantity = Number(product?.opening_quantity) || 0;
  const imageSrc = product?.image_urls?.[0] || product?.image_url;

  return (
    <div className="product-card flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Product Image - smaller */}
      <div className="relative aspect-[4/3] bg-slate-100 cursor-pointer" onClick={() => onViewDetails(product)}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={36} className="text-slate-300" />
          </div>
        )}
        
        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          className="touch-target absolute top-1 right-1 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md hover:bg-white transition"
          title={isInWishlist ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
        >
          <Heart 
            size={14} 
            className={isInWishlist ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} 
          />
        </button>

        {/* Stock Indicator Badge */}
        <div className="absolute top-1 left-1">
          <StockIndicator quantity={stockQuantity} />
        </div>
      </div>

      {/* Product Info - compact */}
      <div className="flex-1 p-2.5 flex flex-col">
        <h3 
          className="text-xs font-bold text-slate-800 mb-0.5 line-clamp-1 cursor-pointer hover:text-indigo-600 transition"
          onClick={() => onViewDetails(product)}
        >
          {product.name}
        </h3>
        
        <p className="text-[9px] text-slate-500 font-mono mb-1">
          {product.code}
        </p>

        {product?.description && (
          <p className="text-[10px] text-slate-600 mb-1 line-clamp-1 flex-1">
            {product.description}
          </p>
        )}

        {/* Price and Actions - compact */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-baseline gap-1">
              <p className="text-sm font-bold text-indigo-600">
                {getUnitPriceWithTax(product).toLocaleString('vi-VN')}đ
              </p>
              {product?.unit && (
                <p className="text-[9px] text-slate-500">/{product.unit}</p>
              )}
            </div>
          </div>
          <p className="text-[9px] text-emerald-600 font-medium mb-1.5">
            Đã bao gồm Thuế VAT 10%
          </p>

          {/* Action Buttons - compact */}
          <div className="flex gap-1.5">
            <button
              onClick={() => (onSecondaryAction ?? onViewDetails)?.(product)}
              className={secondaryClassName}
              title={secondaryLabel}
            >
              <Eye size={13} />
              <span className="text-[10px]">{secondaryLabel}</span>
            </button>
            {onAction && (
              <button
                onClick={() => onAction(product)}
                className={actionClassName}
                title={actionLabel}
              >
                <ShoppingCart size={13} />
                <span className="text-[10px]">{actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}