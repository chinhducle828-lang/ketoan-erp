import React from 'react';
import { Heart, Package } from 'lucide-react';
import { formatPrice, resolveMediaUrl } from '../utils/formatters';

const ImageWithFallback = ({ src, alt, className, iconSize = 18, iconClassName = 'text-slate-400' }) => {
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

const ProductCard = ({ 
  item, 
  onAddToCart, 
  onQuickView, 
  onSelectItem,
  onToggleWishlist,
  isWishlisted,
  selectedCurrency,
  t,
  canUseCart,
  isSalesRole
}) => {
  const previewImage = item.image_urls?.[0] || item.image_url;

  return (
    <div className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-300 hover:bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          {item.category || 'Phổ biến'}
        </span>
        <button 
          onClick={() => onToggleWishlist(item.id)} 
          className={`rounded-full p-2 ${isWishlisted ? 'bg-rose-100 text-rose-600' : 'bg-white text-slate-500'}`}
        >
          <Heart size={15} />
        </button>
      </div>
      
      <button 
        type="button" 
        onClick={() => onSelectItem(item)} 
        className="mt-3 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
      >
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <ImageWithFallback
            src={previewImage}
            alt={item.name}
            className="h-full w-full object-cover"
            iconSize={18}
            iconClassName="text-slate-400"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="truncate text-xs text-slate-500">{item.code} - {item.unit || 'Đơn vị'}</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatPrice(Number(item.price_sell || 0), selectedCurrency)}
          </p>
        </div>
      </button>
      
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button 
          onClick={() => onQuickView(item)} 
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {t('details', 'VI')}
        </button>
        {canUseCart ? (
          <button 
            onClick={() => onAddToCart(item, 1)} 
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            {isSalesRole ? t('addToOrder', 'VI') : t('buyNow', 'VI')}
          </button>
        ) : (
          <button 
            onClick={() => onQuickView(item)} 
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Xem tồn kho
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;