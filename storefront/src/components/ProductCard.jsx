import React from 'react';
import { ShoppingCart, Heart, Eye, Package } from 'lucide-react';
import StockIndicator from './StockIndicator';

/**
 * Product Card Component for Storefront
 * Mobile-optimized with 44px touch targets and visual stock indicators
 * 
 * @param {Object} product - Product data
 * @param {Function} onAddToCart - Add to cart handler
 * @param {Function} onViewDetails - View details handler
 * @param {boolean} isInWishlist - Whether product is in wishlist
 * @param {Function} onToggleWishlist - Wishlist toggle handler
 */
export default function ProductCard({
  product,
  onAction,
  actionLabel = 'Thêm',
  actionClassName = 'touch-target flex-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 active:bg-indigo-800 transition flex items-center justify-center gap-1',
  onViewDetails,
  onSecondaryAction,
  isInWishlist = false,
  onToggleWishlist,
  secondaryLabel = 'Xem',
  secondaryClassName = 'touch-target flex-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 active:bg-slate-300 transition'
}) {
  const unitPrice = Number(product?.price_sell) || 0;
  const stockQuantity = Number(product?.opening_quantity) || 0;
  const imageSrc = product?.image_urls?.[0] || product?.image_url;

  return (
    <div className="product-card flex flex-col">
      {/* Product Image */}
      <div className="relative aspect-square bg-slate-100 cursor-pointer" onClick={() => onViewDetails(product)}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={48} className="text-slate-300" />
          </div>
        )}
        
        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          className="touch-target absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition"
          title={isInWishlist ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
        >
          <Heart 
            size={18} 
            className={isInWishlist ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} 
          />
        </button>

        {/* Stock Indicator Badge */}
        <div className="absolute top-2 left-2">
          <StockIndicator quantity={stockQuantity} />
        </div>
      </div>

      {/* Product Info */}
      <div className="flex-1 p-3 flex flex-col">
        <h3 
          className="text-sm font-bold text-slate-800 mb-1 line-clamp-2 cursor-pointer hover:text-indigo-600 transition"
          onClick={() => onViewDetails(product)}
        >
          {product.name}
        </h3>
        
        <p className="text-[10px] text-slate-500 font-mono mb-2">
          {product.code}
        </p>

        {product?.description && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-2 flex-1">
            {product.description}
          </p>
        )}

        {/* Price and Actions */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-lg font-bold text-indigo-600">
                {unitPrice.toLocaleString('vi-VN')}đ
              </p>
              {product?.unit && (
                <p className="text-[10px] text-slate-500">/{product.unit}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => (onSecondaryAction ?? onViewDetails)?.(product)}
              className={secondaryClassName}
              title={secondaryLabel}
            >
              <Eye size={16} />
              <span>{secondaryLabel}</span>
            </button>
            {onAction && (
              <button
                onClick={() => onAction(product)}
                className={actionClassName}
                title={actionLabel}
              >
                <ShoppingCart size={16} />
                <span>{actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}