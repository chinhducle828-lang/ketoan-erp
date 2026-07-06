import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  MapPin,
  Package,
  Phone,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Truck,
  User,
  X
} from 'lucide-react';
import FloatingCartBar from './components/FloatingCartBar';
import ProductCard from './components/ProductCard';
import QuickViewModal from './components/QuickViewModal';
import WebSocketStatusHUD from './components/WebSocketStatusHUD';
import {
  ROLE_OPTIONS,
  ROLE_BADGE_CLASS,
  ROLE_CAPABILITY_MAP,
  WAREHOUSE_STATUS_OPTIONS,
  WAREHOUSE_STATUS_LABEL,
  SORT_OPTIONS,
  STOREFRONT_ROLE_KEY,
  ALLOW_ROLE_SWITCH
} from './constants';
import {
  formatPrice,
  t,
  formatDisplayDate,
  resolveMediaUrl,
  buildErpLoginUrl,
  buildBearerConfig,
  isSessionAllowedForRole,
  getRoleDisplayName,
  isExplicitNonAdminRole
} from './utils/formatters';
import { publicApi, authApi, API_BASE_URL, getERPUrl, loadWarehouseQueue, adminItemApi, warehouseApi, setAuthenticating } from './utils/api';
import { fetchExchangeRate } from './services/exchangeRate';

const ImageWithFallback = ({
  src,
  alt,
  className,
  iconSize = 18,
  iconClassName = 'text-slate-400'
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
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

const getStoredRole = () => {
  if (typeof window === 'undefined') return 'guest';

  const current = window.sessionStorage.getItem(STOREFRONT_ROLE_KEY);
  if (current) return current;

  // Cleanup legacy persistence to ensure role does not survive app restarts.
  window.localStorage.removeItem(STOREFRONT_ROLE_KEY);
  return 'guest';
};

const setStoredRole = (role) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STOREFRONT_ROLE_KEY, role);
  window.localStorage.removeItem(STOREFRONT_ROLE_KEY);
};

export default function StorefrontPage() {
  const [companyId, setCompanyId] = useState(() => localStorage.getItem('shopCompanyId') || '');
  const [storefrontRole, setStorefrontRole] = useState(() => getStoredRole());
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [sortBy, setSortBy] = useState('featured');
  const [priceMax, setPriceMax] = useState(5000000);
  const [wishlist, setWishlist] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [cart, setCart] = useState([]);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState(null);
  const [quickViewImageIndex, setQuickViewImageIndex] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [shippingCode, setShippingCode] = useState('');
  const [shippingNote, setShippingNote] = useState('');
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    quantity: '1',
    amount: ''
  });
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isRealtimeConnecting, setIsRealtimeConnecting] = useState(false);
  const [lastRealtimeSync, setLastRealtimeSync] = useState(null);
  const [pendingRealtimeOrders, setPendingRealtimeOrders] = useState(0);
  const checkoutSectionRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('VI');
  const [selectedCurrency, setSelectedCurrency] = useState('VND');
  const [storefrontToken, setStorefrontToken] = useState(() => localStorage.getItem('storefrontAccessToken') || '');
  const [hasAdminSession, setHasAdminSession] = useState(false);
  const [authenticatingAdmin, setAuthenticatingAdmin] = useState(false);
  const [authBootstrapDone, setAuthBootstrapDone] = useState(false);
  const [adminSessionChecked, setAdminSessionChecked] = useState(false);
  const [sessionRole, setSessionRole] = useState('');

  const isGuestRole = storefrontRole === 'guest';
  const isAdminRole = storefrontRole === 'admin';
  const isSalesRole = storefrontRole === 'nv_banhang';
  const isWarehouseRole = storefrontRole === 'nv_kho';
  const currentRoleCapabilities = ROLE_CAPABILITY_MAP[storefrontRole] || ROLE_CAPABILITY_MAP.guest;
  const canOrder = currentRoleCapabilities.canOrder;
  const canUseCart = currentRoleCapabilities.canUseCart;
  const canManageItems = currentRoleCapabilities.canManageItems;
  const canTrackQueue = currentRoleCapabilities.canTrackQueue;
  const currentRole = ROLE_OPTIONS.find((role) => role.value === storefrontRole) || ROLE_OPTIONS[0];

  // Dynamic categories computed from items
  const dynamicCategories = useMemo(() => {
    const categorySet = new Set();
    items.forEach(item => {
      const category = String(item?.category || '').trim();
      if (category) categorySet.add(category);
    });
    return ['Tất cả', ...Array.from(categorySet)];
  }, [items]);

  const rollbackToGuest = (message) => {
    setStorefrontRole('guest');
    setStoredRole('guest');
    setHasAdminSession(false);
    setSessionRole('');
    setAdminMessage(message || 'Phiên admin không hợp lệ. Đã chuyển về chế độ Khách vãng lai.');
  };

  const isExplicitNonAdminRole = (roleCode) => {
    const normalized = String(roleCode || '').trim().toLowerCase();
    return normalized !== '' && normalized !== 'admin';
  };

  // If admin session is missing, keep user on storefront and show guidance instead of auto-redirect.
  useEffect(() => {
    if (!isAdminRole) return;
    if (!authBootstrapDone) return;
    if (!adminSessionChecked) return;
    if (authenticatingAdmin) return;
    if (hasAdminSession) return;

    // Build ERP login URL for guidance only (no automatic navigation)
    const erpBase = getERPUrl();
    if (!erpBase) {
      setAdminMessage('Thiếu địa chỉ ERP để xác thực lại admin. Giữ nguyên chế độ admin và chờ phiên hợp lệ.');
      return;
    }
    const loginUrl = buildErpLoginUrl(erpBase, companyId, storefrontRole);
    setAdminMessage(`Chưa có phiên admin hợp lệ. Vui lòng đăng nhập lại từ ERP nếu cần: ${loginUrl}`);
  }, [isAdminRole, authBootstrapDone, adminSessionChecked, hasAdminSession, authenticatingAdmin, companyId, storefrontRole]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const adminImageInputRef = useRef(null);
  const [adminItemForm, setAdminItemForm] = useState({
    code: '',
    name: '',
    description: '',
    unit: '',
    price_sell: '',
    opening_quantity: ''
  });
  const [adminImageFiles, setAdminImageFiles] = useState([]);
  const [adminEditingCode, setAdminEditingCode] = useState('');
  const [warehouseQueue, setWarehouseQueue] = useState([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState('all');
  const [rolePopup, setRolePopup] = useState(null);
  const [salesOrderIds, setSalesOrderIds] = useState(() => {
    try {
      const raw = localStorage.getItem('salesOrderIds');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const previousQueueRef = useRef(new Map());
  const firstQueueLoadRef = useRef(true);
  const salesOrderIdsRef = useRef(salesOrderIds);
  const streamRef = useRef(null);

  const hasCartItems = cart.length > 0;

  const getOrderDisplayDate = (order) => formatDisplayDate(order?.voucher_date || order?.created_at);

  const parsePriceValue = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;

    let raw = String(value).trim();
    if (!raw) return 0;
    raw = raw.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
    if (!raw) return 0;

    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');

    if (lastDot !== -1 && lastComma !== -1) {
      // Keep the last separator as decimal marker, remove the other as thousands marker.
      if (lastComma > lastDot) {
        raw = raw.replace(/\./g, '').replace(/,/g, '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      const fractionalDigits = raw.length - lastComma - 1;
      if (fractionalDigits > 0 && fractionalDigits <= 2) {
        raw = raw.replace(/,/g, '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (lastDot !== -1) {
      const fractionalDigits = raw.length - lastDot - 1;
      if (!(fractionalDigits > 0 && fractionalDigits <= 2)) {
        raw = raw.replace(/\./g, '');
      }
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getUnitPrice = (item) => parsePriceValue(item?.price_sell);
  const getOrderAmount = (item, quantity) => Number((getUnitPrice(item) * Math.max(Number(quantity) || 1, 1)).toFixed(2));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramCompanyId = params.get('company_id') || params.get('companyId');
    const paramRole = params.get('role') || params.get('storefront_role');
    const erpToken = params.get('erp_token');

    if (paramRole && ROLE_OPTIONS.some((item) => item.value === paramRole)) {
      setStorefrontRole(paramRole);
      setStoredRole(paramRole);
    }

    if (paramCompanyId) {
      setCompanyId(paramCompanyId);
      localStorage.setItem('shopCompanyId', paramCompanyId);
    }

    if (erpToken) {
      (async () => {
        setAuthenticating(true);
        setAuthenticatingAdmin(true);
        setAdminSessionChecked(false);
        try {
          await authApi.post('/api/auth/external-login', { erp_token: erpToken, company_id: paramCompanyId, role: paramRole });
          setStorefrontToken(erpToken);
          localStorage.setItem('storefrontAccessToken', erpToken);
          // remove token from URL to avoid leakage
          params.delete('erp_token');
          const nextQuery = params.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
          window.history.replaceState({}, '', nextUrl);

          // validate session with the same token that backend stores in sessions.token
          try {
            const { data } = await authApi.get('/api/auth/me', buildBearerConfig(erpToken));
            const roleCode = data?.user?.role || '';
            const targetRole = paramRole || storefrontRole;
            const canUseSession = isSessionAllowedForRole(targetRole, roleCode);

            setSessionRole(roleCode);
            setHasAdminSession(canUseSession);
            if (canUseSession) {
              setAdminMessage(`Phiên ${getRoleDisplayName(roleCode)} hợp lệ từ ERP.`);
            } else {
              if (targetRole === 'admin') {
                if (isExplicitNonAdminRole(roleCode)) {
                  setHasAdminSession(false);
                  setSessionRole(roleCode);
                  setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ admin. Giữ nguyên chế độ admin và chờ đăng nhập lại từ ERP.`);
                } else {
                  setAdminMessage('Chưa xác thực được phiên admin từ ERP. Giữ nguyên chế độ admin, vui lòng đăng nhập lại từ ERP nếu cần.');
                }
              } else {
                setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ ${getRoleDisplayName(targetRole)}.`);
              }
            }
          } catch (e) {
            // Fallback: try cookie-based validation for environments that support shared cookies
            try {
              const { data } = await authApi.get('/api/auth/me');
              const roleCode = data?.user?.role || '';
              const targetRole = paramRole || storefrontRole;
              const canUseSession = isSessionAllowedForRole(targetRole, roleCode);

              setSessionRole(roleCode);
              setHasAdminSession(canUseSession);
              if (canUseSession) {
                setAdminMessage(`Phiên ${getRoleDisplayName(roleCode)} hợp lệ từ ERP.`);
              } else {
                setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ ${getRoleDisplayName(targetRole)}.`);
              }
            } catch {
            if (paramRole === 'admin') {
              setAdminMessage('Phiên từ ERP chưa được xác thực cho admin. Giữ nguyên chế độ admin và thử xác thực lại.');
              setHasAdminSession(false);
              setSessionRole('');
            } else {
              setAdminMessage('Phiên từ ERP chưa được xác thực. Vui lòng mở storefront lại từ ERP bằng đúng vai trò được phân quyền.');
              setHasAdminSession(false);
              setSessionRole('');
            }
            }
          }
        } catch (err) {
          console.error('External login exchange failed:', err?.response?.data || err.message);
          if (paramRole === 'admin') {
            setAdminMessage('Không thể thiết lập phiên admin từ ERP. Giữ nguyên chế độ admin và chờ xác thực lại.');
            setHasAdminSession(false);
            setSessionRole('');
          } else {
            setAdminMessage('Không thể thiết lập phiên từ ERP. Vui lòng thử mở lại storefront từ ERP.');
            setHasAdminSession(false);
            setSessionRole('');
          }
        } finally {
          setAuthenticating(false);
          setAuthenticatingAdmin(false);
          setAdminSessionChecked(true);
          setAuthBootstrapDone(true);
        }
      })();
    } else {
      setAuthBootstrapDone(true);
    }
  }, []);

  useEffect(() => {
    if (!authBootstrapDone) return;
    if (!(isAdminRole || isWarehouseRole || isSalesRole)) return;

    const validateAdminSession = async () => {
      try {
        setAuthenticating(true);
        setAuthenticatingAdmin(true);
        setAdminSessionChecked(false);
        const meRequest = storefrontToken
          ? authApi.get('/api/auth/me', buildBearerConfig(storefrontToken))
          : authApi.get('/api/auth/me');
        const { data } = await meRequest;
        const roleCode = data?.user?.role || '';
        const canUseSession = isSessionAllowedForRole(storefrontRole, roleCode);

        setSessionRole(roleCode);
        setHasAdminSession(canUseSession);
        if (canUseSession) {
          setAdminMessage(`Phiên ${getRoleDisplayName(roleCode)} hợp lệ từ ERP.`);
        } else {
          if (storefrontRole === 'admin') {
            if (isExplicitNonAdminRole(roleCode)) {
              setHasAdminSession(false);
              setSessionRole(roleCode);
              setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ admin. Giữ nguyên chế độ admin và chờ đăng nhập lại từ ERP.`);
            } else {
              setAdminMessage('Chưa xác thực được phiên admin. Giữ nguyên chế độ admin và chờ đồng bộ phiên từ ERP.');
            }
          } else {
            setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ ${getRoleDisplayName(storefrontRole)}.`);
          }
        }
      } catch {
        try {
          const { data } = await authApi.get('/api/auth/me');
          const roleCode = data?.user?.role || '';
          const canUseSession = isSessionAllowedForRole(storefrontRole, roleCode);

          setSessionRole(roleCode);
          setHasAdminSession(canUseSession);
          if (canUseSession) {
            setAdminMessage(`Phiên ${getRoleDisplayName(roleCode)} hợp lệ từ ERP.`);
          } else if (storefrontRole === 'admin') {
            setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ admin. Giữ nguyên chế độ admin và chờ đồng bộ phiên từ ERP.`);
          } else {
            setAdminMessage(`Phiên ERP hiện tại (${getRoleDisplayName(roleCode) || 'không xác định'}) không phù hợp với chế độ ${getRoleDisplayName(storefrontRole)}.`);
          }
        } catch {
          if (storefrontRole === 'admin') {
            setAdminMessage('Không nhận được phiên admin từ ERP. Giữ nguyên chế độ admin và thử xác thực lại.');
            setHasAdminSession(false);
            setSessionRole('');
          } else {
            setAdminMessage('Không nhận được phiên từ ERP. Vui lòng mở storefront từ ERP để tiếp tục thao tác theo vai trò hiện tại.');
            setHasAdminSession(false);
            setSessionRole('');
          }
        }
      } finally {
        setAuthenticating(false);
        setAuthenticatingAdmin(false);
        setAdminSessionChecked(true);
      }
    };

    validateAdminSession();
  }, [authBootstrapDone, isAdminRole, isWarehouseRole, isSalesRole, storefrontRole]);

  const loadItems = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await publicApi.get('/items', { params: { company_id: id } });
      setItems(data || []);
      if (data?.length) {
        setSelectedItem(data[0]);
        setSelectedImageIndex(0);
        setCheckoutForm((prev) => ({ ...prev, quantity: '1', amount: String(getOrderAmount(data[0], 1)) }));
      } else {
        setSelectedItem(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadItems(companyId);
    }
  }, [companyId]);

  // enhance loadItems error logging for production troubleshooting

  const handleCompanySubmit = (e) => {
    e.preventDefault();
    const trimmed = companyId.trim();
    if (!trimmed) {
      setError('Vui lòng nhập mã doanh nghiệp để mở gian hàng.');
      return;
    }
    localStorage.setItem('shopCompanyId', trimmed);
    loadItems(trimmed);
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setSelectedImageIndex(0);
    setCheckoutForm((prev) => ({ ...prev, quantity: '1', amount: String(getOrderAmount(item, 1)) }));
    setRecentlyViewed((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)].slice(0, 4));
  };

  const handleViewStock = (item) => {
    handleItemSelect(item);
    const openingQuantity = Number(item?.opening_quantity || 0);
    const unitLabel = item?.unit || 'đơn vị';

    setRolePopup({
      id: `stock-view-${Date.now()}`,
      title: `Tồn kho: ${item?.name || item?.code || 'Sản phẩm'}`,
      message: `SL tồn tham chiếu: ${openingQuantity.toLocaleString('vi-VN')} ${unitLabel}`
    });
  };

  const handleQuantityChange = (rawValue) => {
    const nextQuantity = Math.max(Number(rawValue) || 1, 1);
    setCheckoutForm((prev) => ({
      ...prev,
      quantity: String(nextQuantity),
      amount: String(getOrderAmount(selectedItem, nextQuantity))
    }));
  };

  const removeCartItem = (itemId) => {
    setCart((prev) => prev.filter((entry) => entry.id !== itemId));
  };

  const handleMobileCheckout = () => {
    setShowMiniCart(false);
    if (checkoutSectionRef.current) {
      checkoutSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const addToCart = (item, qty = 1) => {
    if (!canUseCart) {
      setError('Vai trò hiện tại không thực hiện đặt đơn trực tiếp trên storefront.');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) => (entry.id === item.id ? { ...entry, quantity: entry.quantity + qty } : entry));
      }
      return [...prev, { ...item, quantity: qty }];
    });
    setShowMiniCart(true);
    setSuccess(`Đã thêm ${item.name} vào giỏ hàng.`);
  };

  const updateCartQuantity = (itemId, delta) => {
    setCart((prev) => prev.flatMap((entry) => {
      if (entry.id !== itemId) return [entry];
      const nextQty = entry.quantity + delta;
      return nextQty > 0 ? [{ ...entry, quantity: nextQty }] : [];
    }));
  };

  const toggleWishlist = (itemId) => {
    setWishlist((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const openQuickView = (item) => {
    setQuickViewItem(item);
    setQuickViewImageIndex(0);
    setShowQuickView(true);
  };

  const getItemImages = (item) => {
    const gallery = Array.isArray(item?.image_urls) ? item.image_urls : [];
    const merged = [...gallery, item?.image_url].filter(Boolean);
    return [...new Set(merged)];
  };

  const quickViewImages = useMemo(() => getItemImages(quickViewItem), [quickViewItem]);
  const quickViewCurrentImage = quickViewImages[quickViewImageIndex] || null;
  const quickViewDescription = (quickViewItem?.description || '').trim() || 'Sản phẩm được tối ưu cho trải nghiệm mua hàng nhanh với thông tin đầy đủ và nút mua ngay.';

  const showQuickViewPrevImage = () => {
    if (quickViewImages.length <= 1) return;
    setQuickViewImageIndex((prev) => (prev - 1 + quickViewImages.length) % quickViewImages.length);
  };

  const showQuickViewNextImage = () => {
    if (quickViewImages.length <= 1) return;
    setQuickViewImageIndex((prev) => (prev + 1) % quickViewImages.length);
  };

  const filteredItems = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();
    const normalizedCategory = String(activeCategory || '').trim().toLowerCase();

    const nextItems = [];
    for (const item of items) {
      const name = String(item?.name || '').toLowerCase();
      const code = String(item?.code || '').toLowerCase();
      const category = String(item?.category || 'Phổ biến').toLowerCase();
      const price = getUnitPrice(item);

      const matchCategory = activeCategory === 'Tất cả' || category.includes(normalizedCategory);
      const matchSearch = !term || name.includes(term) || code.includes(term);
      const matchPrice = price <= priceMax;

      if (matchCategory && matchSearch && matchPrice) {
        nextItems.push(item);
      }
    }

    if (sortBy === 'priceAsc') {
      nextItems.sort((a, b) => getUnitPrice(a) - getUnitPrice(b));
    } else if (sortBy === 'priceDesc') {
      nextItems.sort((a, b) => getUnitPrice(b) - getUnitPrice(a));
    } else if (sortBy === 'newest') {
      nextItems.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }

    return nextItems;
  }, [items, searchTerm, activeCategory, sortBy, priceMax]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + getUnitPrice(item) * item.quantity, 0), [cart]);
  const discountAmount = couponCode.trim().toUpperCase() === 'SAVE10' ? cartSubtotal * 0.1 : 0;
  const totalAfterDiscount = cartSubtotal - discountAmount;
  const shippingEstimate = shippingCode.trim().length >= 4 ? 'Miễn phí vận chuyển trong 24h' : 'Nhập mã bưu chính để xem phí ship';
  const hasCheckoutCart = cart.length > 0;
  const fallbackPreviewAmount = isSalesRole
    ? 0
    : Number(checkoutForm.amount || getOrderAmount(selectedItem, checkoutForm.quantity));
  const checkoutPreviewAmount = hasCheckoutCart
    ? Number(totalAfterDiscount.toFixed(2))
    : fallbackPreviewAmount;
  const promoHighlights = useMemo(() => {
    const fromDescriptions = items
      .filter((item) => typeof item.description === 'string' && item.description.trim().length > 0)
      .slice(0, 2)
      .map((item) => item.description.trim());

    if (fromDescriptions.length > 0) {
      return fromDescriptions;
    }

    const fromProducts = [...items]
      .sort((a, b) => getUnitPrice(a) - getUnitPrice(b))
      .slice(0, 2)
      .map((item) => `Giá tốt hôm nay: ${item.name} từ ${formatPrice(getUnitPrice(item), selectedCurrency)}.`);

    if (fromProducts.length > 0) {
      return fromProducts;
    }

    return [
      'Ưu đãi sẽ hiển thị ngay khi doanh nghiệp cập nhật mô tả sản phẩm trong ERP.',
      'Bạn có thể chỉnh nội dung này bằng mô tả trong danh mục sản phẩm.'
    ];
  }, [items, selectedCurrency]);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();

    if (!canOrder) {
      setError('Vai trò hiện tại không được tạo đơn bán hàng trên storefront.');
      return;
    }

    if (!companyId || (!hasCheckoutCart && !selectedItem)) {
      setError('Vui lòng chọn doanh nghiệp và sản phẩm trước khi đặt hàng.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        companyId: Number(companyId),
        ...(hasCheckoutCart
          ? {
              items: cart.map((entry) => ({
                itemId: entry.id,
                quantity: Number(entry.quantity || 1)
              }))
            }
          : {
              itemId: selectedItem.id,
              quantity: Number(checkoutForm.quantity || 1)
            }),
        customerName: checkoutForm.customerName,
        phone: checkoutForm.phone,
        address: checkoutForm.address,
        amount: checkoutPreviewAmount,
        taxRate: 0.1
      };

      const { data } = await publicApi.post('/orders', payload);
      setSuccess(`Đặt hàng thành công. Mã chứng từ: ${data.voucherNumber || data.voucherId}`);
      if (data?.voucherId) {
        setSalesOrderIds((prev) => {
          const next = [...new Set([Number(data.voucherId), ...prev])].slice(0, 60);
          localStorage.setItem('salesOrderIds', JSON.stringify(next));
          return next;
        });
      }
      setRolePopup({
        id: `sales-created-${Date.now()}`,
        title: 'Đơn hàng đã chuyển xử lý',
        message: 'Đơn đã được gửi cho kho và giám đốc theo dõi xử lý.'
      });
      setCart([]);
      setShowMiniCart(false);
      setCheckoutForm((prev) => ({
        ...prev,
        customerName: '',
        phone: '',
        address: '',
        quantity: '1',
        amount: String(getOrderAmount(selectedItem, 1))
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể gửi đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCouponApply = () => {
    if (couponCode.trim().toUpperCase() === 'SAVE10') {
      setCouponMessage('Mã giảm giá áp dụng thành công.');
    } else {
      setCouponMessage('Mã giảm giá không hợp lệ.');
    }
  };

  const handleRoleChange = (nextRole) => {
    setStorefrontRole(nextRole);
    setStoredRole(nextRole);
    setHasAdminSession(false);
    setSessionRole('');
    setAdminSessionChecked(false);
    setError('');
    setSuccess('');
    if (nextRole !== 'nv_banhang' && nextRole !== 'guest') {
      setShowMiniCart(false);
      setCart([]);
    }
    setAdminMessage('');
  };

  const getAdminAuthConfig = () => {
    if (storefrontToken) return { headers: { Authorization: `Bearer ${storefrontToken}` } };
    return { withCredentials: true };
  };

  const loadWarehouseQueue = async ({ source = 'poll', keepLoadingState = true } = {}) => {
    if (!companyId) {
      setWarehouseQueue([]);
      return;
    }

    if (keepLoadingState) {
      setWarehouseLoading(true);
    }
    try {
      const { data } = await authApi.get('/api/logistics/queue-details', {
        params: { company_id: companyId },
        ...getAdminAuthConfig()
      });

      const nextList = Array.isArray(data) ? data : [];
      const nextMap = new Map(nextList.map((order) => [Number(order.id), order]));
      const previousMap = previousQueueRef.current;

      if (!firstQueueLoadRef.current && source !== 'realtime') {
        const addedPendingOrders = nextList.filter((order) => {
          const id = Number(order.id);
          return !previousMap.has(id) && order.loading_status === 'pending_loading';
        });

        const completedOrders = nextList.filter((order) => {
          const id = Number(order.id);
          const previous = previousMap.get(id);
          return previous && previous.loading_status !== 'completed' && order.loading_status === 'completed';
        });

        if ((isAdminRole || isWarehouseRole) && addedPendingOrders.length > 0) {
          setRolePopup({
            id: `added-${Date.now()}`,
            title: isWarehouseRole ? 'Đơn hàng mới cần xuất kho' : 'Thông báo xuất kho mới',
            message: `Có ${addedPendingOrders.length} đơn web mới đang chờ xuất kho.`
          });
        } else if ((isAdminRole || isWarehouseRole) && completedOrders.length > 0) {
          setRolePopup({
            id: `completed-role-${Date.now()}`,
            title: 'Cập nhật hoàn thành đơn',
message: `${completedOrders[0].voucherNumber || 'Đơn hàng'} đã được kho hoàn thành.`
          });
        }

        if (isSalesRole && completedOrders.length > 0) {
          const completedForSales = completedOrders.filter((order) => salesOrderIds.includes(Number(order.id)));
          if (completedForSales.length > 0) {
            const completedIds = new Set(completedForSales.map((order) => Number(order.id)));
            const remaining = salesOrderIds.filter((id) => !completedIds.has(Number(id)));
            setSalesOrderIds(remaining);
            localStorage.setItem('salesOrderIds', JSON.stringify(remaining));
            setRolePopup({
              id: `completed-sales-${Date.now()}`,
              title: 'Đơn hàng đã hoàn thành',
message: `${completedForSales[0].voucherNumber || 'Đơn hàng'} đã được kho xử lý hoàn tất.`
            });
          }
        }
      }

      previousQueueRef.current = nextMap;
      firstQueueLoadRef.current = false;
      setWarehouseQueue(nextList);
    } catch (err) {
      // Xử lý 401/403 âm thầm - tải queue không cần thiết cho mọi role
      const status = err.response?.status;
      if (status !== 401 && status !== 403) {
        if (isWarehouseRole || isAdminRole) {
          setError(err.response?.data?.error || 'Không thể tải danh sách chờ xuất kho.');
        }
      }
      // Nếu 401/403, chỉ log nhẹ và tiếp tục - polling sẽ tự động chạy lại
    } finally {
      if (keepLoadingState) {
        setWarehouseLoading(false);
      }
    }
  };

  useEffect(() => {
    salesOrderIdsRef.current = salesOrderIds;
  }, [salesOrderIds]);

  useEffect(() => {
    if (!canTrackQueue) return;
    if (!companyId) return;

    previousQueueRef.current = new Map();
    firstQueueLoadRef.current = true;

    loadWarehouseQueue();
    const timer = setInterval(() => loadWarehouseQueue({ source: 'poll', keepLoadingState: false }), 60000);
    return () => clearInterval(timer);
  }, [companyId, canTrackQueue]);

  useEffect(() => {
    if (!canTrackQueue || !companyId) return;

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    setIsRealtimeConnecting(true);
    setIsRealtimeConnected(false);

    const streamUrl = new URL(`${API_BASE_URL}/api/logistics/stream`);
    streamUrl.searchParams.set('company_id', String(companyId));
    if (storefrontToken) {
      streamUrl.searchParams.set('access_token', storefrontToken);
    }

    const eventSource = new EventSource(
      streamUrl.toString(),
      storefrontToken ? undefined : { withCredentials: true }
    );
    streamRef.current = eventSource;

    const refreshFromRealtime = () => {
      loadWarehouseQueue({ source: 'realtime', keepLoadingState: false });
    };

    eventSource.onopen = () => {
      setIsRealtimeConnecting(false);
      setIsRealtimeConnected(true);
      setLastRealtimeSync(new Date().toISOString());
    };

    eventSource.addEventListener('order_created', (rawEvent) => {
      let payload = {};
      try {
        payload = JSON.parse(String(rawEvent?.data || '{}'));
      } catch {
        payload = {};
      }

      if (isAdminRole || isWarehouseRole) {
        setRolePopup({
          id: `rt-order-created-${Date.now()}`,
          title: isWarehouseRole ? 'Đơn mới chờ xuất kho' : 'Đơn mới từ bán hàng',
          message: `${payload.voucherNumber || 'Đơn web'} vừa được tạo lúc ${new Date().toLocaleTimeString('vi-VN')}.`
        });
      }

      refreshFromRealtime();
    });

    eventSource.addEventListener('logistics_status_changed', (rawEvent) => {
      let payload = {};
      try {
        payload = JSON.parse(String(rawEvent?.data || '{}'));
      } catch {
        payload = {};
      }

      const voucherId = Number(payload?.voucherId);
      const voucherNumber = payload?.voucherNumber || 'Đơn hàng';
      const loadingStatus = String(payload?.loadingStatus || '').trim();
      const statusLabel = WAREHOUSE_STATUS_LABEL[loadingStatus] || loadingStatus || 'được cập nhật';

      if (isAdminRole || isWarehouseRole) {
        setRolePopup({
          id: `rt-status-${Date.now()}`,
          title: 'Cập nhật trạng thái đơn',
          message: `${voucherNumber}: ${statusLabel}.`
        });
      }

      if (isSalesRole && loadingStatus === 'completed' && Number.isFinite(voucherId)) {
        const trackedIds = salesOrderIdsRef.current || [];
        if (trackedIds.includes(voucherId)) {
          const remaining = trackedIds.filter((id) => Number(id) !== voucherId);
          setSalesOrderIds(remaining);
          localStorage.setItem('salesOrderIds', JSON.stringify(remaining));
          setRolePopup({
            id: `rt-sales-completed-${Date.now()}`,
            title: 'Đơn hàng đã hoàn thành',
            message: `${voucherNumber} đã được kho xử lý hoàn tất.`
          });
        }
      }

      refreshFromRealtime();
    });

    eventSource.onerror = (err) => {
      setIsRealtimeConnecting(false);
      setIsRealtimeConnected(false);
      
      // Check if the error is an auth failure (401) by checking the event source readyState
      // EventSource auto-closes on 401, so we detect token expiry and clean up
      if (storefrontToken && eventSource.readyState === EventSource.CLOSED) {
        // Token likely expired - clear it and fall back to cookie-based polling
        const wasTokenCleared = localStorage.getItem('storefrontAccessToken');
        if (wasTokenCleared) {
          localStorage.removeItem('storefrontAccessToken');
          setStorefrontToken('');
          // Don't redirect - just fall back to cookie-based polling quietly
          setAdminMessage('Phiên admin đã hết hạn. Chuyển sang chế độ polling dự phòng.');
        }
      }
      // Keep lightweight polling as fallback when stream reconnects.
    };

    eventSource.onmessage = (rawEvent) => {
      setLastRealtimeSync(new Date().toISOString());
      try {
        const data = JSON.parse(String(rawEvent?.data || '{}'));
        if (data.pendingOrders !== undefined) {
          setPendingRealtimeOrders(Number(data.pendingOrders));
        }
      } catch {
        // ignore invalid event data
      }
    };

    return () => {
      eventSource.close();
      if (streamRef.current === eventSource) {
        streamRef.current = null;
      }
    };
  }, [companyId, canTrackQueue, storefrontToken, isAdminRole, isWarehouseRole, isSalesRole]);

  useEffect(() => {
    if (!rolePopup) return;
    const timer = setTimeout(() => setRolePopup(null), 5000);
    return () => clearTimeout(timer);
  }, [rolePopup]);

  const warehouseFilteredQueue = useMemo(() => {
    if (warehouseStatusFilter === 'all') return warehouseQueue;
    return warehouseQueue.filter((order) => order.loading_status === warehouseStatusFilter);
  }, [warehouseQueue, warehouseStatusFilter]);

  // Fetch exchange rate on component mount to populate localStorage
  useEffect(() => {
    fetchExchangeRate().catch(() => {});
  }, []);

  // Listen for auth token expiry from the axios interceptor
  useEffect(() => {
    const handleAuthExpired = (event) => {
      setStorefrontToken('');
      setHasAdminSession(false);
      setSessionRole('');
      if (event?.detail?.message) {
        setAdminMessage(event.detail.message);
      }
    };
    window.addEventListener('storefront:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('storefront:auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    if (isSalesRole) {
      setShowMiniCart(true);
    }
  }, [isSalesRole]);

  const fillAdminFormFromItem = (item) => {
    setAdminEditingCode(item.code);
    setAdminItemForm({
      code: item.code,
      name: item.name,
      description: item.description || '',
      unit: item.unit || '',
      price_sell: String(item.price_sell || ''),
      opening_quantity: String(item.opening_quantity ?? '')
    });
    setAdminImageFiles([]);
    setSuccess('');
    setError('');
  };

  const resetAdminItemForm = () => {
    setAdminEditingCode('');
    setAdminItemForm({
      code: '',
      name: '',
      description: '',
      unit: '',
      price_sell: '',
      opening_quantity: ''
    });
    setAdminImageFiles([]);
    if (adminImageInputRef.current) {
      adminImageInputRef.current.value = '';
    }
  };

  const handleAdminPickImages = () => {
    adminImageInputRef.current?.click();
  };

  const handleAdminImageFilesChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 6);
    setAdminImageFiles(files);
  };

  const handleRemoveAdminImage = (indexToRemove) => {
    setAdminImageFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAdminItemSubmit = async (e) => {
    e.preventDefault();
    if (!canManageItems) return;
    if (!storefrontToken) {
      // proceed using cookie-based session (external-login) if present on server
      setAdminMessage('Vui lòng đảm bảo đã mở storefront từ ERP bằng tài khoản admin trước khi quản lý sản phẩm.');
    }
    if (!companyId) {
      setAdminMessage('Thiếu company_id, không thể lưu danh mục.');
      return;
    }
    if (!adminItemForm.code.trim() || !adminItemForm.name.trim() || !adminItemForm.unit.trim()) {
      setAdminMessage('Mã, tên và đơn vị tính là bắt buộc.');
      return;
    }

    setAdminBusy(true);
    setAdminMessage('');
    try {
      const payload = new FormData();
      payload.append('code', adminItemForm.code.trim().toUpperCase());
      payload.append('name', adminItemForm.name.trim());
      payload.append('description', adminItemForm.description.trim());
      payload.append('unit', adminItemForm.unit.trim());
      payload.append('price_sell', String(Number(adminItemForm.price_sell || 0)));
      payload.append('opening_quantity', String(Number(adminItemForm.opening_quantity || 0)));
      payload.append('companyId', String(Number(companyId)));
      adminImageFiles.forEach((file) => payload.append('images', file));

      if (adminEditingCode) {
        await authApi.put(
          `/api/items/${encodeURIComponent(adminEditingCode)}`,
          payload,
          getAdminAuthConfig()
        );
        setAdminMessage('Cập nhật sản phẩm thành công.');
      } else {
        await authApi.post('/api/items', payload, getAdminAuthConfig());
        setAdminMessage('Tạo sản phẩm mới thành công.');
      }

      resetAdminItemForm();
      await loadItems(companyId);
    } catch (err) {
      setAdminMessage(err.response?.data?.error || 'Không thể lưu sản phẩm.');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleAdminDeleteItem = async (itemCode) => {
    if (!canManageItems) {
      setAdminMessage('Bạn chưa có quyền để xóa sản phẩm.');
      return;
    }
    if (!companyId) {
      setAdminMessage('Thiếu company_id, không thể xóa sản phẩm.');
      return;
    }

    setAdminBusy(true);
    setAdminMessage('');
    try {
      await authApi.delete(
        `/api/items/${encodeURIComponent(itemCode)}`,
        {
          ...getAdminAuthConfig(),
          params: { company_id: Number(companyId) }
        }
      );
      setAdminMessage(`Đã xóa sản phẩm ${itemCode}.`);
      if (adminEditingCode === itemCode) {
        resetAdminItemForm();
      }
      await loadItems(companyId);
    } catch (err) {
      setAdminMessage(err.response?.data?.error || 'Không thể xóa sản phẩm.');
    } finally {
      setAdminBusy(false);
    }
  };

  const handleWarehouseComplete = async (order) => {
    if (!companyId) return;

    try {
      const currentStatus = String(order?.loading_status || '').trim();
      if (currentStatus === 'pending_loading') {
        await authApi.post(
          '/api/logistics/assign-truck',
          { companyId: Number(companyId), voucherId: Number(order.id), truckId: order?.truck_id || null },
          getAdminAuthConfig()
        );
      }

      if (currentStatus === 'assigned' || currentStatus === 'pending_loading') {
        await authApi.post(
          '/api/logistics/confirm-loaded',
          { companyId: Number(companyId), voucherId: Number(order.id) },
          getAdminAuthConfig()
        );
      }

      await authApi.post(
        '/api/logistics/mark-completed',
        { companyId: Number(companyId), voucherId: Number(order.id) },
        getAdminAuthConfig()
      );
      setRolePopup({
        id: `warehouse-completed-${Date.now()}`,
        title: 'Đã xác nhận hoàn thành',
message: `${order.voucherNumber || 'Đơn hàng'} đã được cập nhật hoàn thành.`
      });
      loadWarehouseQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể cập nhật trạng thái hoàn thành đơn.');
    }
  };

  if (isSalesRole) {
    return (
      <>
        <div className="page-shell bg-[radial-gradient(circle_at_top_left,_#ecfdf5,_#f8fafc_45%,_#f1f5f9_85%)] text-slate-900">
          <div className="content-shell py-5 lg:py-7">
            <WebSocketStatusHUD
              className="hidden md:block"
              isConnected={isRealtimeConnected}
              isConnecting={isRealtimeConnecting}
              lastSync={lastRealtimeSync}
              pendingOrders={pendingRealtimeOrders}
            />
            <header className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white/95 p-5 shadow-[0_18px_60px_-24px_rgba(15,23,42,0.35)] lg:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <Sparkles size={14} /> Vật liệu xây dựng chất lượng
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Vai trò storefront:</span>
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${ROLE_BADGE_CLASS[currentRole.value] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {currentRole.label}
                  </span>
                </div>
              </div>

              {ALLOW_ROLE_SWITCH && (
                <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                  <span className="px-1 font-semibold text-slate-700">Chuyển role (dev):</span>
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleRoleChange(role.value)}
                      className={`rounded-xl px-3 py-1.5 font-semibold ${storefrontRole === role.value ? 'bg-emerald-500 text-slate-950' : 'bg-white hover:bg-emerald-50'}`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Quầy bán hàng POS - Tạo hóa đơn nhanh</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">Màn hình dành riêng cho nhân viên bán hàng: chọn hàng, cập nhật số lượng và chốt hóa đơn nhanh tại quầy.</p>
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">POS Mode: Nhân viên bán hàng</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:grid-cols-1">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-600">
                    <button type="button" onClick={() => setSelectedLang('VI')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${selectedLang === 'VI' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-white'}`}>VI</button>
                    <button type="button" onClick={() => setSelectedLang('EN')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${selectedLang === 'EN' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-white'}`}>EN</button>
                    <button type="button" onClick={() => setSelectedCurrency('VND')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${selectedCurrency === 'VND' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-white'}`}>VND</button>
                    <button type="button" onClick={() => setSelectedCurrency('USD')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${selectedCurrency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-white'}`}>USD</button>
                  </div>
                  <button onClick={() => setShowMiniCart((prev) => !prev)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25">
                    <ShoppingCart size={18} /> Màn hình POS {cartCount > 0 ? `(${cartCount})` : ''}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto] md:items-end">
                <form onSubmit={handleCompanySubmit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <label className="space-y-1 text-sm text-slate-600">
                    <span>Doanh nghiệp đang xem</span>
                    <input
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      placeholder="Nhập company_id để tải danh mục"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                    />
                  </label>
                  <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Tải gian hàng</button>
                </form>
                <div className="text-xs text-slate-500">Đang ở chế độ nội bộ. Có thể đổi về Khách vãng lai ở thanh role.</div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Sản phẩm trong đơn</p>
                  <p className="mt-1 text-lg font-bold text-emerald-900">{cart.length} dòng - {cartCount} món</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Tạm tính hiện tại</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{formatPrice(checkoutPreviewAmount, selectedCurrency)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Đơn đang theo dõi</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{warehouseQueue.length} đơn</p>
                </div>
              </div>
            </div>
          </header>

          {showMiniCart && (
            <div className="mt-5 rounded-[24px] border border-emerald-200 bg-white p-4 shadow-[0_12px_36px_-20px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Giỏ hàng nhanh</h2>
                <button onClick={() => setShowMiniCart(false)} className="rounded-full bg-slate-100 p-2 text-slate-500">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="text-sm text-slate-500">Giỏ hàng hiện trống.</p>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatPrice(getUnitPrice(item), selectedCurrency)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateCartQuantity(item.id, -1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm">-</button>
                        <span className="w-6 text-center text-sm font-semibold text-slate-800">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.id, 1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm">+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Sản phẩm khả dụng</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{filteredItems.length}</p>
              <p className="mt-2 text-sm text-slate-500">Danh sách sản phẩm đang được hiển thị.</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Số lượng trong giỏ</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{cartCount}</p>
              <p className="mt-2 text-sm text-slate-500">Phù hợp cho thao tác thanh toán nhanh.</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Đơn chờ đồng bộ</p>
              <p className="mt-3 text-3xl font-black text-slate-900">{pendingRealtimeOrders}</p>
              <p className="mt-2 text-sm text-slate-500">Đơn đang chờ cập nhật từ backend.</p>
            </div>
          </div>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_0.95fr]">
            <div className="space-y-4 rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.35)]">
              <div className="grid gap-3 lg:grid-cols-[1.45fr_0.55fr]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('search', selectedLang)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none">
                    {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span>{t('maxPrice', selectedLang)}: {formatPrice(priceMax, selectedCurrency)}</span>
                    <input type="range" min="500000" max="5000000" step="100000" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="mt-1 w-full accent-emerald-500" />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                {dynamicCategories.map((item) => (
                  <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeCategory === item ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'}`}>
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">{t('noProducts', selectedLang)}</div>
                ) : filteredItems.map((item) => {
                  const isWishlisted = wishlist.includes(item.id);
                  return (
                    <ProductCard
                      key={item.id}
                      product={item}
                      onViewDetails={openQuickView}
                      onSecondaryAction={canUseCart ? undefined : handleViewStock}
                      onAction={(currentItem) => addToCart(currentItem, 1)}
                      actionLabel={t('addToOrder', selectedLang)}
                      actionClassName="touch-target flex-1 bg-emerald-500 text-slate-950 rounded-lg text-xs font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2"
                      secondaryLabel={t('details', selectedLang)}
                      secondaryClassName="touch-target flex-1 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition flex items-center justify-center gap-2"
                      onToggleWishlist={(itemId) => toggleWishlist(itemId)}
                      isInWishlist={isWishlisted}
                    />
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-4 self-start">
              <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.45)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Chi tiết đơn tại quầy</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">{cartCount} món</span>
                </div>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-3 text-sm text-slate-500">Chưa có sản phẩm. Chọn hàng ở danh sách bên trái để bắt đầu.</div>
                  ) : (
                    cart.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-emerald-100 bg-white p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
                          <p className="text-xs font-semibold text-slate-700">{formatPrice(Number(entry.price_sell || 0), selectedCurrency)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button type="button" onClick={() => updateCartQuantity(entry.id, -1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">-</button>
                          <span className="w-7 text-center text-sm font-semibold text-slate-800">{entry.quantity}</span>
                          <button type="button" onClick={() => updateCartQuantity(entry.id, 1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">+</button>
                          <div className="ml-auto text-xs font-semibold text-slate-700">{formatPrice(getUnitPrice(entry) * entry.quantity, selectedCurrency)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-emerald-100 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold text-slate-900">{formatPrice(cartSubtotal, selectedCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Giảm giá</span>
                    <span className="font-semibold text-slate-900">{formatPrice(discountAmount, selectedCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-slate-700">
                    <span className="font-semibold">Tổng tạm tính</span>
                    <span className="text-lg font-black text-slate-900">{formatPrice(checkoutPreviewAmount, selectedCurrency)}</span>
                  </div>
                </div>
              </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <h3 className="text-base font-bold text-slate-900">{t('selectedProduct', selectedLang)}</h3>
                {selectedItem ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{selectedItem.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedItem.code} - {selectedItem.unit || t('unit', selectedLang)}</p>
                    <p className="mt-2 text-sm font-bold text-slate-900">{formatPrice(getUnitPrice(selectedItem), selectedCurrency)}</p>
                    <button onClick={() => addToCart(selectedItem, Number(checkoutForm.quantity || 1))} className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
                      {t('addToOrder', selectedLang)} ({checkoutForm.quantity || 1})
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{t('selectProduct', selectedLang)}</p>
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <h3 className="text-base font-bold text-slate-900">Gợi ý bán nhanh tại quầy</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {promoHighlights.map((highlight, index) => (
                    <div key={`${highlight}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {highlight}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Thanh toán quầy POS</h3>
                  <p className="text-sm text-slate-500">Nhập nhanh thông tin khách và chốt hóa đơn tại quầy.</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">Checkout</span>
              </div>

              {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
              {success && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16} />{success}</div>}

              <form onSubmit={handleCheckoutSubmit} className="mt-4 space-y-4">
                {hasCheckoutCart && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                    Đơn hàng sẽ tạo đồng thời {cart.length} sản phẩm trong giỏ ({cartCount} món).
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><User size={14} />{t('customerName', selectedLang)}</span><input required value={checkoutForm.customerName} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                  <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><Phone size={14} />{t('phone', selectedLang)}</span><input required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                </div>
                <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><MapPin size={14} />{t('address', selectedLang)}</span><input required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-600"><span>{t('quantity', selectedLang)}</span><input type="number" min="1" value={hasCheckoutCart ? cartCount : checkoutForm.quantity} onChange={(e) => !hasCheckoutCart && handleQuantityChange(e.target.value)} readOnly={hasCheckoutCart} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                  <label className="space-y-1 text-sm text-slate-600"><span>{t('amount', selectedLang)}</span><input type="number" min="0" value={checkoutPreviewAmount} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600"><BadgePercent size={14} /> {t('coupon', selectedLang)}</div>
                  <div className="mt-2.5 flex gap-2">
                    <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Nhập SAVE10" className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none" />
                    <button type="button" onClick={handleCouponApply} className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">{t('apply', selectedLang)}</button>
                  </div>
                  {couponMessage && <p className="mt-2 text-sm text-emerald-700">{couponMessage}</p>}
                </div>

                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">{submitting ? 'Đang tạo đơn...' : t('checkout', selectedLang)} <ArrowRight size={16} /></button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Thao tác nhanh POS</h3>
                  <span className="text-xs text-slate-500">Ca hiện tại</span>
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Ưu tiên nhập tên khách và số điện thoại để kho giao đúng địa chỉ.</div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Gom nhiều mã hàng trong cùng hóa đơn để giảm thao tác.</div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Hóa đơn tạm tính: {formatPrice(checkoutPreviewAmount, selectedCurrency)}</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <h3 className="text-base font-bold text-slate-900">Vận chuyển nhanh</h3>
                <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder={t('enterPostalCode', selectedLang)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                <p className="mt-2 text-xs text-slate-500">{shippingEstimate}</p>
                <textarea
                  value={shippingNote}
                  onChange={(e) => setShippingNote(e.target.value)}
                  rows={3}
                  placeholder="Ghi chú giao hàng cho bộ phận kho"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
                <h3 className="text-base font-bold text-slate-900">Theo dõi xử lý đơn</h3>
                {warehouseQueue.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Chưa có đơn trong hàng chờ xuất kho.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {warehouseQueue.slice(0, 4).map((order) => (
                      <div key={`sales-track-${order.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
<p className="truncate text-sm font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                        <p className="mt-1 text-xs text-slate-500">{WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status} • Ngày: {getOrderDisplayDate(order)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {rolePopup && (
            <div className="fixed right-4 top-4 z-50 w-80 rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{rolePopup.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{rolePopup.message}</p>
                </div>
                <button type="button" onClick={() => setRolePopup(null)} className="text-slate-400 hover:text-slate-600">x</button>
              </div>
            </div>
          )}

          {showQuickView && quickViewItem && (
            <QuickViewModal
              item={quickViewItem}
              onClose={() => setShowQuickView(false)}
              onAddToCart={(item, qty) => addToCart(item, qty)}
              onToggleWishlist={(itemId) => toggleWishlist(itemId)}
              isWishlisted={wishlist.includes(quickViewItem.id)}
              selectedCurrency={selectedCurrency}
              t={t}
              canUseCart={canUseCart}
              canManageItems={canManageItems}
              isSalesRole={isSalesRole}
              onEditItem={fillAdminFormFromItem}
            />
          )}
        </div>
      </div>
      <FloatingCartBar
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onCheckout={handleMobileCheckout}
        onClose={() => setShowMiniCart(false)}
        subtotal={cartSubtotal}
        itemCount={cartCount}
      />
    </>
  );
  }

  return (
    <div className="page-shell bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="content-shell py-6">
        <WebSocketStatusHUD
          className="hidden md:block"
          isConnected={isRealtimeConnected}
          isConnecting={isRealtimeConnecting}
          lastSync={lastRealtimeSync}
          pendingOrders={pendingRealtimeOrders}
          onReconnect={() => {
            if (streamRef.current) streamRef.current.close();
            setTimeout(() => {
              if (companyId) {
                setIsRealtimeConnecting(true);
                setIsRealtimeConnected(false);
                loadWarehouseQueue({ source: 'poll', keepLoadingState: false });
              }
            }, 200);
          }}
        />
        <header className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-2xl shadow-slate-300/20 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                <Sparkles size={16} /> Vật liệu xây dựng chất lượng
              </div>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Vai trò storefront:</span>
                <span className={`rounded-full border px-2.5 py-1 font-semibold ${ROLE_BADGE_CLASS[currentRole.value] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {currentRole.label}
                </span>
              </div>
              {ALLOW_ROLE_SWITCH && (
                <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600">
                  <span className="px-1 font-semibold text-slate-700">Chuyển role (dev):</span>
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleRoleChange(role.value)}
                      className={`rounded-xl px-3 py-1.5 font-semibold ${storefrontRole === role.value ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 hover:bg-slate-100'}`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{isSalesRole ? 'Quầy bán hàng POS - Tạo hóa đơn nhanh' : 'Mua vật liệu xây dựng nhanh chóng'}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{isSalesRole ? 'Màn hình dành riêng cho nhân viên bán hàng: chọn hàng, cập nhật số lượng và chốt hóa đơn ngay tại quầy.' : 'Tìm kiếm gạch, sơn, xi măng, thép và vật tư xây dựng giá tốt trên cùng một trang. Đặt hàng nhanh, giao hàng tận công trình.'}</p>
                {isGuestRole && (
                  <p className="mt-2 max-w-2xl text-sm font-medium text-violet-700">Bạn đang ở chế độ khách vãng lai, có thể xem sản phẩm và đặt hàng nhanh mà không cần đăng nhập.</p>
                )}
                {isSalesRole && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">POS Mode: Nhân viên bán hàng</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100/90 p-2 text-sm text-slate-600 sm:w-auto">
                <button type="button" onClick={() => setSelectedLang('VI')} className={`rounded-2xl px-3 py-2 text-sm ${selectedLang === 'VI' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-slate-100'}`}>VI</button>
                <button type="button" onClick={() => setSelectedLang('EN')} className={`rounded-2xl px-3 py-2 text-sm ${selectedLang === 'EN' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-slate-100'}`}>EN</button>
                <button type="button" onClick={() => setSelectedCurrency('VND')} className={`rounded-2xl px-3 py-2 text-sm ${selectedCurrency === 'VND' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-slate-100'}`}>VND</button>
                <button type="button" onClick={() => setSelectedCurrency('USD')} className={`rounded-2xl px-3 py-2 text-sm ${selectedCurrency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'hover:bg-slate-100'}`}>USD</button>
              </div>
              {canUseCart ? (
                <button onClick={() => setShowMiniCart((prev) => !prev)} className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-600/20">
                  <ShoppingCart size={18} /> {isSalesRole ? `Màn hình POS ${cartCount > 0 ? `(${cartCount})` : ''}` : `Giỏ hàng ${cartCount > 0 ? `(${cartCount})` : ''}`}
                </button>
              ) : (
                <div className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                  <Package size={18} /> {isAdminRole ? 'Quản lý danh mục' : 'Chế độ kho'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            {dynamicCategories.map((item) => (
              <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-full px-4 py-2 text-sm ${activeCategory === item ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'}`}>
                {item}
              </button>
            ))}
            <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-4 py-2 text-sm text-slate-600 hover:border-emerald-500">
              <SlidersHorizontal size={14} /> {isSalesRole ? 'Bộ lọc POS' : 'Lọc theo vật liệu'}
            </button>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-100/80 p-4 md:grid-cols-[1fr_auto] md:items-end">
            <form onSubmit={handleCompanySubmit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="space-y-1 text-sm text-slate-600">
                <span>Doanh nghiệp đang xem</span>
                <input
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="Nhập company_id để tải danh mục"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none"
                />
              </label>
              <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Tải gian hàng</button>
            </form>
            {!isGuestRole ? (
              <div className="text-xs text-slate-500">Đang ở chế độ nội bộ. Có thể đổi về Khách vãng lai ở thanh role.</div>
            ) : (
              getERPUrl() ? (
                <a href={buildErpLoginUrl(getERPUrl(), companyId, storefrontRole)} className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700">
                  Nhân viên? Đăng nhập ERP
                </a>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                  Thiếu VITE_ERP_URL để chuyển về ERP
                </span>
              )
            )}
          </div>
        </header>

        {showMiniCart && (
          <div className="rounded-[24px] border border-emerald-400/20 bg-white/90 p-4 shadow-xl shadow-slate-300/20 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Giỏ hàng nhanh</h2>
              <button onClick={() => setShowMiniCart(false)} className="rounded-full bg-slate-100 p-2 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-slate-500">Giỏ hàng hiện trống.</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">{formatPrice(getUnitPrice(item), selectedCurrency)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartQuantity(item.id, -1)} className="rounded-full bg-slate-100 px-2 py-1 text-sm">-</button>
                      <span className="text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, 1)} className="rounded-full bg-slate-100 px-2 py-1 text-sm">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-slate-600">
              <span>Tổng</span>
              <span className="font-semibold text-slate-900">{formatPrice(cartSubtotal, selectedCurrency)}</span>
            </div>
          </div>
        )}

        <section className={`mt-6 grid gap-6 ${isSalesRole ? 'xl:grid-cols-[1.55fr_1fr]' : 'xl:grid-cols-[1.9fr_1fr]'}`}>
          <div className="space-y-6">
            {isSalesRole && (
              <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">POS Counter</p>
                    <p className="text-sm text-emerald-800">Quét/tìm sản phẩm ở cột trái và chốt hóa đơn ở cột phải.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                      <ShoppingBag size={14} /> {cartCount} món
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                      <Clock3 size={14} /> Tổng tạm tính {formatPrice(checkoutPreviewAmount, selectedCurrency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className={`rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur ${isSalesRole ? 'ring-1 ring-emerald-200/70' : ''}`}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                    <Building2 size={16} /> Vật tư công trình
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">{isSalesRole ? 'Danh mục hàng hóa tại quầy' : 'Chọn vật liệu chất lượng, giao nhanh'}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{isSalesRole ? 'Ưu tiên thao tác nhanh: chọn hàng, thêm vào hóa đơn, chỉnh số lượng và chốt đơn.' : 'Duyệt vật liệu xây dựng theo danh mục, so sánh giá và hoàn tất đơn hàng nhanh chóng ngay trên web.'}</p>
                  </div>
                </div>
                {!isSalesRole && (
                  <div className="rounded-[24px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-slate-200/40 p-5 text-sm text-slate-700">
                    <div className="flex items-center gap-2 text-slate-900"><Truck size={16} /> Giao hàng 24h</div>
                    <div className="mt-3 flex items-center gap-2 text-slate-900"><BadgePercent size={16} /> Giảm giá đặc biệt</div>
                    <div className="mt-3 flex items-center gap-2 text-slate-900"><CheckCircle2 size={16} /> Hỗ trợ đổi trả</div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="relative rounded-[24px] border border-slate-200 bg-slate-100/90 p-4">
                  <Search className="pointer-events-none absolute left-4 top-4 text-slate-500" size={18} />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isSalesRole ? 'Tìm nhanh theo tên hoặc mã hàng...' : 'Tìm sản phẩm, danh mục...'}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-100/90 p-4 text-sm text-slate-600">
                    <span>Sắp xếp</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none">
                      {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 rounded-[24px] border border-slate-200 bg-slate-100/90 p-4 text-sm text-slate-600">
                    <span>Giá tối đa</span>
                    <input type="range" min="500000" max="5000000" step="100000" value={priceMax} onChange={(e) => setPriceMax(Number(e.target.value))} className="w-full accent-emerald-500" />
                    <p className="text-xs text-slate-500">Đến {formatPrice(priceMax, selectedCurrency)}</p>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {dynamicCategories.map((item) => (
                <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-[24px] border px-4 py-4 text-left text-sm text-slate-700 transition ${activeCategory === item ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200 bg-slate-100/90 hover:border-emerald-500'}`}>
                    <span className="block font-semibold text-slate-900">{item}</span>
                    <span className="mt-2 block text-xs text-slate-500">Khám phá danh mục {item === 'Tất cả' ? 'toàn bộ' : item.toLowerCase()}</span>
                </button>
              ))}
            </div>

            <div className={`grid gap-4 ${isSalesRole ? 'md:grid-cols-2 xl:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
              {filteredItems.length === 0 ? (
                <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-slate-50/90 p-8 text-center text-slate-500">{t('noProducts', selectedLang)}</div>
              ) : filteredItems.map((item) => {
                const isWishlisted = wishlist.includes(item.id);
                return (
                  <ProductCard
                    key={item.id}
                    product={item}
                    onViewDetails={openQuickView}
                    onSecondaryAction={canUseCart ? undefined : handleViewStock}
                    onAction={canUseCart ? (currentItem) => addToCart(currentItem, 1) : undefined}
                    actionLabel={isSalesRole ? t('addToOrder', selectedLang) : t('buyNow', selectedLang)}
                    actionClassName="touch-target flex-1 bg-emerald-500 text-slate-950 rounded-lg text-xs font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2"
                    secondaryLabel={canUseCart ? t('details', selectedLang) : 'Xem tồn kho'}
                    secondaryClassName="touch-target flex-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition flex items-center justify-center gap-2"
                    onToggleWishlist={(itemId) => toggleWishlist(itemId)}
                    isInWishlist={isWishlisted}
                  />
                );
              })}
            </div>
          </div>

          <aside className={`space-y-4 ${isSalesRole ? 'xl:sticky xl:top-4 self-start' : ''}`}>
            <div className="rounded-[24px] border border-slate-200/70 bg-slate-100/70 p-4 shadow-xl shadow-slate-300/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300"><Package size={16} /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{isWarehouseRole || isAdminRole ? 'Theo dõi nhập xuất' : 'Chi tiết sản phẩm'}</h3>
                  <p className="text-xs text-slate-500">{isWarehouseRole ? 'Chế độ kho chỉ theo dõi dữ liệu vật tư và trạng thái vận hành.' : isAdminRole ? 'Admin storefront quản lý danh mục sản phẩm tách biệt ERP.' : isGuestRole ? 'Khách vãng lai có thể duyệt sản phẩm và thêm vào giỏ mà không cần đăng nhập.' : 'Xem nhanh và thao tác giỏ hàng trong 1 khung.'}</p>
                </div>
              </div>

              {isWarehouseRole || isAdminRole ? (
                <div className="mt-4 space-y-3">
                  {selectedItem ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                      <p className="text-xs text-slate-500">Mặt hàng đang theo dõi</p>
                      <p className="font-semibold text-slate-900">{selectedItem.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedItem.code} • {selectedItem.unit || 'Đơn vị'}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-2">Giá tham chiếu: {formatPrice(getUnitPrice(selectedItem), selectedCurrency)}</div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">Loại hàng: {selectedItem.category || 'Phổ biến'}</div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 sm:col-span-2">Tồn kho tham chiếu: {Number(selectedItem.opening_quantity || 0).toLocaleString('vi-VN')} {selectedItem.unit || 'đơn vị'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-500">Chọn một vật tư để theo dõi chi tiết.</div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <p className="text-sm font-semibold text-slate-900">{isAdminRole ? 'Nhiệm vụ theo vai trò admin bán hàng' : 'Nhiệm vụ theo vai trò kho'}</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {isAdminRole ? (
                        <>
                          <li>Quản lý danh mục sản phẩm trực tiếp trên storefront.</li>
                          <li>Chuẩn hóa mã hàng, đơn vị tính và ảnh hiển thị.</li>
                          <li>Tách vận hành danh mục khỏi ERP kế toán.</li>
                        </>
                      ) : (
                        <>
                          <li>Kiểm tra mã vật tư, đơn vị tính và hình ảnh.</li>
                          <li>Đối chiếu lô hàng trước khi xuất kho.</li>
                          <li>Phối hợp giao vận theo doanh nghiệp đang chọn.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              ) : isSalesRole ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-emerald-700">Hóa đơn đang tạo</p>
                        <p className="font-semibold text-emerald-900">{cart.length} sản phẩm • {cartCount} món</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                        {formatPrice(checkoutPreviewAmount, selectedCurrency)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="text-xs text-slate-600">Sản phẩm trong hóa đơn</div>
                    <div className="mt-2 max-h-[40vh] space-y-2 overflow-y-auto pr-1 md:max-h-72">
                      {cart.length === 0 ? (
                        <p className="text-sm text-slate-500">Chưa có sản phẩm. Chọn hàng ở danh sách bên trái để bắt đầu.</p>
                      ) : (
                        cart.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
                              <p className="text-xs font-semibold text-slate-700">{formatPrice(Number(entry.price_sell || 0), selectedCurrency)}</p>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <button type="button" onClick={() => updateCartQuantity(entry.id, -1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">-</button>
                              <span className="w-7 text-center text-sm font-semibold text-slate-800">{entry.quantity}</span>
                              <button type="button" onClick={() => updateCartQuantity(entry.id, 1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">+</button>
                              <div className="ml-auto text-xs font-semibold text-slate-700">
                                {formatPrice(getUnitPrice(entry) * entry.quantity, selectedCurrency)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : hasCheckoutCart ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">{t('selectedProduct', selectedLang)}</p>
                        <p className="font-semibold text-slate-900">{cart.length} sản phẩm trong giỏ</p>
                        <p className="mt-1 text-xs text-slate-500">Số lượng tổng: {cartCount} món</p>
                      </div>
                      <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{formatPrice(checkoutPreviewAmount, selectedCurrency)}</div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-2.5">
                      <div className="text-xs text-slate-600">Chi tiết từng sản phẩm</div>
                      <div className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto pr-1 md:max-h-72">
                        {cart.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
                                <p className="text-xs text-slate-500">{entry.code} • {entry.unit || 'Đơn vị'}</p>
                              </div>
                              <p className="text-xs font-semibold text-slate-700">{formatPrice(Number(entry.price_sell || 0), selectedCurrency)}</p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <button type="button" onClick={() => updateCartQuantity(entry.id, -1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">-</button>
                              <span className="w-7 text-center text-sm font-semibold text-slate-800">{entry.quantity}</span>
                              <button type="button" onClick={() => updateCartQuantity(entry.id, 1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">+</button>
                              <div className="ml-auto text-xs font-semibold text-slate-700">
                                {formatPrice(getUnitPrice(entry) * entry.quantity, selectedCurrency)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 border-t border-slate-200 pt-2 text-right text-sm font-semibold text-slate-800">
                        Thành tiền: {formatPrice(checkoutPreviewAmount, selectedCurrency)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Truck size={15} /> Ước tính phí ship</div>
                    <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder={t('enterPostalCode', selectedLang)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                    <p className="mt-2 text-xs text-slate-500">{shippingEstimate}</p>
                  </div>
                </div>
              ) : selectedItem ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">{t('selectedProduct', selectedLang)}</p>
                        <p className="font-semibold text-slate-900">{selectedItem.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Đơn giá: {formatPrice(getUnitPrice(selectedItem), selectedCurrency)}/{selectedItem.unit || 'đơn vị'}</p>
                      </div>
                      <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{formatPrice(getUnitPrice(selectedItem), selectedCurrency)}</div>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-2.5">
                      <div className="text-sm text-slate-600">Số lượng cần mua</div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button type="button" onClick={() => handleQuantityChange(Number(checkoutForm.quantity || 1) - 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700">-</button>
                        <input
                          type="number"
                          min="1"
                          value={checkoutForm.quantity}
                          onChange={(e) => handleQuantityChange(e.target.value)}
                          className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-center text-sm text-slate-900 outline-none"
                        />
                        <button type="button" onClick={() => handleQuantityChange(Number(checkoutForm.quantity || 1) + 1)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700">+</button>
                        <div className="ml-auto text-sm font-semibold text-slate-700">
                          Thành tiền: {formatPrice(Number(checkoutForm.amount || 0), selectedCurrency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-300"><Clock3 size={15} /> Flash sale còn</div>
                    <div className="mt-1.5 text-xs text-slate-500">03:12:47</div>
                    <button onClick={() => addToCart(selectedItem, Number(checkoutForm.quantity || 1))} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">{t('addToCart', selectedLang)} ({checkoutForm.quantity || 1})</button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Truck size={15} /> Ước tính phí ship</div>
                    <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder={t('enterPostalCode', selectedLang)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                    <p className="mt-2 text-xs text-slate-500">{shippingEstimate}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-500">{t('selectProduct', selectedLang)}</div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-100/70 p-4 shadow-xl shadow-slate-300/20 backdrop-blur">
              <h3 className="text-lg font-bold text-slate-900">{isSalesRole ? 'Gợi ý bán nhanh tại quầy' : 'Ưu đãi vật liệu'}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {promoHighlights.map((highlight, index) => (
                  <div key={`${highlight}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                    {highlight}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {canOrder ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{isGuestRole ? 'Đặt hàng nhanh cho khách vãng lai' : isSalesRole ? 'Thanh toán quầy POS' : 'Thanh toán nhanh'}</h3>
                <p className="text-sm text-slate-500">{isGuestRole ? 'Không cần tài khoản, chỉ cần thông tin liên hệ để tạo đơn.' : isSalesRole ? 'Nhập nhanh thông tin khách và chốt hóa đơn tại quầy.' : 'Hoàn tất đơn hàng chỉ trong một bước.'}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">Checkout</span>
            </div>

            {error && <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
            {success && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><CheckCircle2 size={16} />{success}</div>}

            <form onSubmit={handleCheckoutSubmit} className="mt-5 space-y-4">
              {hasCheckoutCart && (
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  Đơn hàng sẽ đặt đồng thời {cart.length} sản phẩm trong giỏ ({cartCount} món).
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><User size={14} />{t('customerName', selectedLang)}</span><input required value={checkoutForm.customerName} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><Phone size={14} />{t('phone', selectedLang)}</span><input required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              </div>
              <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><MapPin size={14} />{t('address', selectedLang)}</span><input required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600"><span>{t('quantity', selectedLang)}</span><input type="number" min="1" value={hasCheckoutCart ? cartCount : checkoutForm.quantity} onChange={(e) => !hasCheckoutCart && handleQuantityChange(e.target.value)} readOnly={hasCheckoutCart} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                <label className="space-y-1 text-sm text-slate-600"><span>{t('amount', selectedLang)}</span><input type="number" min="0" value={checkoutPreviewAmount} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                <div className="flex items-center gap-2 text-sm text-slate-600"><BadgePercent size={14} /> {t('coupon', selectedLang)}</div>
                <div className="mt-3 flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Nhập SAVE10" className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                  <button type="button" onClick={handleCouponApply} className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">{t('apply', selectedLang)}</button>
                </div>
                {couponMessage && <p className="mt-2 text-sm text-emerald-300">{couponMessage}</p>}
              </div>
              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">{submitting ? 'Đang tạo đơn...' : t('checkout', selectedLang)} <ArrowRight size={16} /></button>
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-5 shadow-xl shadow-slate-300/20 backdrop-blur">
            {isSalesRole ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Thao tác nhanh POS</h3>
                  <span className="text-sm text-slate-500">Ca bán hiện tại</span>
                </div>
                <div className="mt-4 grid gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">Mẹo: nhập tên khách và số điện thoại để kho theo dõi giao hàng chính xác.</div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">Ưu tiên chốt đơn theo giỏ hàng để gom nhiều mã hàng trong cùng hóa đơn.</div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm font-semibold text-emerald-700">Hóa đơn tạm tính: {formatPrice(checkoutPreviewAmount, selectedCurrency)}</div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Thông tin mua hàng</h3>
                  <span className="text-sm text-slate-500">Dữ liệu thật từ hệ thống</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">
                    Hình ảnh, giá và tồn kho được đồng bộ trực tiếp từ dữ liệu doanh nghiệp.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">
                    Storefront không hiển thị điểm sao hoặc nhận xét khi chưa có dữ liệu đánh giá thực tế.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700">
                    Ảnh lỗi hoặc thiếu sẽ tự chuyển sang biểu tượng thay thế để tránh vỡ giao diện.
                  </div>
                </div>
              </>
            )}
          </div>
          </section>
        ) : (
          <section className="mt-6 rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
            <h3 className="text-xl font-bold text-slate-900">{isAdminRole ? 'Chế độ admin bán hàng' : 'Chế độ nhân viên kho'}</h3>
            <p className="mt-2 text-sm text-slate-600">{isAdminRole ? 'Admin quản lý danh mục sản phẩm trên storefront. Chức năng checkout được tắt để phân tách nhiệm vụ khỏi web kế toán ERP.' : 'Trang này đang hiển thị giao diện theo dõi vật tư và phối hợp giao nhận. Chức năng giỏ hàng, thanh toán và tạo đơn bán được ẩn theo phân quyền.'}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-sm font-semibold text-slate-900">Doanh nghiệp đang thao tác</p>
                <p className="mt-1 text-sm text-slate-600">{companyId || 'Chưa chọn doanh nghiệp'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-sm font-semibold text-slate-900">Sản phẩm khả dụng</p>
                <p className="mt-1 text-sm text-slate-600">{filteredItems.length} mặt hàng theo bộ lọc hiện tại</p>
              </div>
            </div>
          </section>
        )}

        {isAdminRole && (
          <section className="mt-6 rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Quản lý danh mục sản phẩm (Storefront Admin)</h3>
                <p className="text-sm text-slate-600">Phân hệ này thay thế mục ItemManagement trên ERP cho vai trò admin bán hàng.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <h4 className="font-semibold text-slate-900">Phiên admin từ ERP</h4>
              <p className="mt-2 text-sm text-slate-600">
                {authenticatingAdmin ? 'Đang xác thực phiên admin từ ERP...' : hasAdminSession ? 'Đã nhận phiên quản trị từ ERP, bạn có thể tạo/cập nhật danh mục.' : 'Chưa có phiên admin. Vui lòng mở storefront từ ERP bằng tài khoản admin để thao tác.'}
              </p>
              {adminMessage && <p className="mt-2 text-sm text-slate-500">{adminMessage}</p>}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                <h4 className="font-semibold text-slate-900">Tạo/Cập nhật sản phẩm</h4>
                <form onSubmit={handleAdminItemSubmit} className="mt-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={adminItemForm.code} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="Mã sản phẩm" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                    <input value={adminItemForm.unit} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="Đơn vị tính" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                  </div>
                  <input value={adminItemForm.name} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Tên sản phẩm" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                  <textarea value={adminItemForm.description} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Mô tả" rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input type="number" min="0" value={adminItemForm.price_sell} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, price_sell: e.target.value }))} placeholder="Giá bán" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                    <input type="number" min="0" value={adminItemForm.opening_quantity} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, opening_quantity: e.target.value }))} placeholder="Số lượng nhập kho" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none" />
                  </div>
                  <input
                    ref={adminImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAdminImageFilesChange}
                  />
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={handleAdminPickImages} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">Thêm ảnh</button>
                      <span className="text-xs text-slate-500">Tối đa 6 ảnh, ảnh đầu tiên là ảnh đại diện.</span>
                    </div>
                    {adminImageFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {adminImageFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                            <span>{file.name}</span>
                            <button type="button" onClick={() => handleRemoveAdminImage(idx)} className="font-semibold text-rose-600">x</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={adminBusy || !hasAdminSession} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{adminEditingCode ? 'Lưu cập nhật' : 'Tạo mới'}</button>
                    <button type="button" onClick={resetAdminItemForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Làm mới form</button>
                  </div>
                </form>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <h4 className="font-semibold text-slate-900">Thông báo xuất kho</h4>
              <p className="mt-2 text-sm text-slate-600">Đang theo dõi {warehouseQueue.length} đơn trong hàng đợi xuất kho.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <h4 className="font-semibold text-slate-900">Theo dõi tiến độ đơn xuất kho</h4>
              <div className="mt-3 space-y-2">
                {warehouseQueue.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có đơn xuất kho để theo dõi.</p>
                ) : (
                  warehouseQueue.slice(0, 8).map((order) => (
                    <div key={`admin-track-${order.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="min-w-0">
<p className="truncate text-sm font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                        <p className="text-xs text-slate-500">{order.description || 'Đơn web'} • Ngày: {getOrderDisplayDate(order)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.loading_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                        {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <h4 className="font-semibold text-slate-900">3. Danh mục hiện tại</h4>
              <div className="mt-3 space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có sản phẩm trong doanh nghiệp đang chọn.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id || item.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.code} - {item.name}</p>
                        <p className="text-xs text-slate-500">{formatPrice(getUnitPrice(item), selectedCurrency)} • {item.unit || 'Đơn vị'} • SL nhập: {Number(item.opening_quantity || 0).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => fillAdminFormFromItem(item)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">Sửa</button>
                        <button type="button" onClick={() => handleAdminDeleteItem(item.code)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">Xóa</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {isWarehouseRole && (
          <section className="mt-6 rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
            <h3 className="text-xl font-bold text-slate-900">Theo dõi số lượng cần xuất kho</h3>
            <p className="mt-2 text-sm text-slate-600">Danh sách dưới đây là số lượng bán hàng do nhân viên bán hàng nhập, dùng để bốc và xuất đúng số lượng.</p>

            <div className="mt-4 max-w-sm">
              <label className="space-y-1 text-sm text-slate-600">
                <span>Lọc theo trạng thái</span>
                <select
                  value={warehouseStatusFilter}
                  onChange={(e) => setWarehouseStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                >
                  {WAREHOUSE_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {!hasAdminSession ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Chưa có phiên từ ERP. Hãy mở storefront từ tài khoản nhân viên kho trên ERP.</div>
            ) : warehouseLoading ? (
              <div className="mt-4 text-sm text-slate-500">Đang tải hàng đợi xuất kho...</div>
            ) : warehouseFilteredQueue.length === 0 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Không có đơn phù hợp với bộ lọc trạng thái.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {warehouseFilteredQueue.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
<p className="text-sm font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                        <p className="text-xs text-slate-500">{order.description || 'Đơn web'} • Ngày: {getOrderDisplayDate(order)} • Trạng thái: {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}</p>
                      </div>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Tổng SL: {Number(order.total_quantity || 0).toLocaleString('vi-VN')}</span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {order.lines?.length > 0 ? order.lines.map((line, idx) => (
                        <div key={`${order.id}-${line.item_id || idx}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">{line.item_code} - {line.item_name}</p>
                            <p className="text-xs text-slate-500">Đơn vị: {line.item_unit || '-'}</p>
                          </div>
                          <div className="text-sm font-bold text-slate-900">{Number(line.quantity || 0).toLocaleString('vi-VN')}</div>
                        </div>
                      )) : (
                        <div className="text-xs text-slate-500">Không có dòng sản phẩm chi tiết.</div>
                      )}
                    </div>

                    {order.loading_status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleWarehouseComplete(order)}
                        className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Hoàn thành đơn xuất kho
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {rolePopup && (
          <div className="fixed right-4 top-4 z-50 w-80 rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{rolePopup.title}</p>
                <p className="mt-1 text-sm text-slate-600">{rolePopup.message}</p>
              </div>
              <button type="button" onClick={() => setRolePopup(null)} className="text-slate-400 hover:text-slate-600">x</button>
            </div>
          </div>
        )}

        {showQuickView && quickViewItem && (
          <QuickViewModal
            item={quickViewItem}
            onClose={() => setShowQuickView(false)}
            onAddToCart={(item, qty) => addToCart(item, qty)}
            onToggleWishlist={(itemId) => toggleWishlist(itemId)}
            isWishlisted={wishlist.includes(quickViewItem.id)}
            selectedCurrency={selectedCurrency}
            t={t}
            canUseCart={canUseCart}
            canManageItems={canManageItems}
            isSalesRole={isSalesRole}
            onEditItem={fillAdminFormFromItem}
          />
        )}
      </div>
      <FloatingCartBar
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onCheckout={handleMobileCheckout}
        onClose={() => setShowMiniCart(false)}
        subtotal={cartSubtotal}
        itemCount={cartCount}
      />
    </div>
  );
}