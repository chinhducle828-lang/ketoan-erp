/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// Constants for Storefront
export const ROLE_OPTIONS = [
  { value: 'guest', label: 'Khách vãng lai' },
  { value: 'admin', label: 'Admin bán hàng' },
  { value: 'nv_banhang', label: 'Nhân viên bán hàng' },
  { value: 'nv_kho', label: 'Nhân viên kho' }
];

export const ROLE_BADGE_CLASS = {
  guest: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
  nv_banhang: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  nv_kho: 'bg-sky-100 text-sky-700 border-sky-200'
};

export const ROLE_CAPABILITY_MAP = {
  guest: {
    canOrder: true,
    canUseCart: true,
    canManageItems: false,
    canTrackQueue: false  // Guest không cần đồng bộ queue - không có auth
  },
  admin: {
    canOrder: false,
    canUseCart: false,
    canManageItems: true,
    canTrackQueue: true
  },
  nv_banhang: {
    canOrder: true,
    canUseCart: true,
    canManageItems: false,
    canTrackQueue: true
  },
  nv_kho: {
    canOrder: false,
    canUseCart: false,
    canManageItems: false,
    canTrackQueue: true
  }
};

export const WAREHOUSE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending_loading', label: 'Chờ xuất kho' },
  { value: 'assigned', label: 'Đã phân xe' },
  { value: 'delivering', label: 'Đang giao hàng' }
];

export const WAREHOUSE_STATUS_TYPES = {
  pendingLoading: 'pending_loading',
  assigned: 'assigned',
  delivering: 'delivering',
  completed: 'completed'
};

export const WAREHOUSE_STATUS_SUMMARY_KEYS = Object.values(WAREHOUSE_STATUS_TYPES);

export const WAREHOUSE_STATUS_LABEL = {
  pending_loading: 'Chờ xuất kho',
  assigned: 'Đã phân xe',
  delivering: 'Đang giao hàng',
  completed: 'Đã hoàn thành'
};

export const WAREHOUSE_STATUS_BADGE_CLASS = {
  pending_loading: 'border-amber-200 bg-amber-50 text-amber-700',
  assigned: 'border-sky-200 bg-sky-50 text-sky-700',
  delivering: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  default: 'border-slate-200 bg-slate-50 text-slate-700'
};

export const WAREHOUSE_STATUS_CARD_CLASS = {
  pending_loading: 'border-amber-200 bg-amber-50/70',
  assigned: 'border-sky-200 bg-sky-50/70',
  delivering: 'border-indigo-200 bg-indigo-50/70',
  completed: 'border-emerald-200 bg-emerald-50/70',
  default: 'border-slate-200 bg-white'
};

export const SORT_OPTIONS = [
  { value: 'featured', label: 'Nổi bật' },
  { value: 'priceAsc', label: 'Giá thấp → cao' },
  { value: 'priceDesc', label: 'Giá cao → thấp' },
  { value: 'newest', label: 'Mới nhất' }
];

export const ORDER_STATUS_TYPES = {
  pending: 'pending',
  processing: 'processing',
  shipping: 'shipping',
  completed: 'completed',
  cancelled: 'cancelled'
};

export const STOREFRONT_ROLE_KEY = 'storefrontRole';

// Feature flag for role switching UI (dev only, defaults to false in production)
export const ALLOW_ROLE_SWITCH = import.meta.env.VITE_ALLOW_ROLE_SWITCH === 'true';