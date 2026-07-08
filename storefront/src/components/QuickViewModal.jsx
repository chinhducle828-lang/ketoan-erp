/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Package } from 'lucide-react';
import { formatPrice, resolveMediaUrl, getUnitPrice, getOrderAmount } from '../utils/formatters';

const ImageWithFallback = ({ src, alt, className, iconSize = 24, iconClassName = 'text-slate-400' }) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedSrc = resolveMediaUrl(src);
  if (!resolvedSrc || hasError) {
    return <Package size={iconSize} className={iconClassName} />;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};

const QuickViewModal = ({
  item,
  onClose,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
  selectedCurrency,
  t,
  canUseCart,
  canManageItems,
  isSalesRole,
  onEditItem
}) => {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [quantity, setQuantity] = React.useState(1);

  if (!item) return null;

  const images = item.image_urls?.length ? item.image_urls : [item.image_url].filter(Boolean);
  const currentImage = images[currentImageIndex] || null;

  const nextImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleAddToCart = () => {
    onAddToCart(item, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6">
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={20} />
        </button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Image Carousel */}
          <div className="relative">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-50">
              <ImageWithFallback
                src={currentImage}
                alt={item.name}
                className="h-full w-full object-cover"
                iconSize={48}
                iconClassName="text-slate-300"
              />
            </div>
            {images.length > 1 && (
              <>
                <button 
                  onClick={prevImage} 
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={nextImage} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
            <p className="text-sm text-slate-500">{item.code}</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatPrice(getUnitPrice(item), selectedCurrency)}
            </p>
            
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="font-medium">Danh mục:</span> {item.category || 'Khác'}</p>
              <p><span className="font-medium">Đơn vị:</span> {item.unit || 'N/A'}</p>
              <p><span className="font-medium">Mô tả:</span> {item.description || 'Không có mô tả'}</p>
            </div>

            {canUseCart && (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-sm font-medium">Số lượng:</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center"
                />
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {canUseCart ? (
                <button 
                  onClick={handleAddToCart} 
                  className="flex-1 rounded-xl bg-emerald-500 py-2 font-semibold text-slate-950"
                >
                  {isSalesRole ? t('addToOrder', 'VI') : t('buyNow', 'VI')}
                </button>
              ) : (
                <button 
                  onClick={onClose} 
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold"
                >
                  {t('trackStock', 'VI')}
                </button>
              )}
              {canManageItems && (
                <button 
                  onClick={() => { onEditItem(item); onClose(); }} 
                  className="rounded-xl border border-amber-200 bg-amber-50 py-2 px-4 font-semibold text-amber-700"
                >
                  {t('edit', 'VI')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;