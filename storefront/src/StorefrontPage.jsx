/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

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
import Footer from './components/Footer';
import {
  ROLE_OPTIONS,
  ROLE_BADGE_CLASS,
  ROLE_CAPABILITY_MAP,
  WAREHOUSE_STATUS_OPTIONS,
  WAREHOUSE_STATUS_LABEL,
  WAREHOUSE_STATUS_BADGE_CLASS,
  WAREHOUSE_STATUS_CARD_CLASS,
  WAREHOUSE_STATUS_TYPES,
  WAREHOUSE_STATUS_SUMMARY_KEYS,
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
  isExplicitNonAdminRole,
  getUnitPriceWithTax
} from './utils/formatters';
import { publicApi, authApi, API_BASE_URL, getERPUrl, setAuthenticating, findOrCreatePartner } from './utils/api';
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
  const [showCassoModal, setShowCassoModal] = useState(false);
  const [cassoAccounts, setCassoAccounts] = useState([]);
  const [cassoLoading, setCassoLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
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
  const [selectedWarehouseOrder, setSelectedWarehouseOrder] = useState(null);
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

  const isGuestRole = storefrontRole === 'guest';
  const isAdminRole = storefrontRole === 'admin';
  const isSalesRole = storefrontRole === 'nv_banhang';
  const isWarehouseRole = storefrontRole === 'nv_kho';
  const currentRoleCapabilities = ROLE_CAPABILITY_MAP[storefrontRole] || ROLE_CAPABILITY_MAP.guest;
  const canOrder = currentRoleCapabilities.canOrder;
  const canUseCart = currentRoleCapabilities.canUseCart;
  const canManageItems = currentRoleCapabilities.canManageItems;
  const canTrackQueue = currentRoleCapabilities.canTrackQueue;
  const hasStorefrontSession = Boolean(storefrontToken || hasAdminSession);
  const canUseRealtimeQueue = canTrackQueue && hasStorefrontSession;
  const currentRole = ROLE_OPTIONS.find((role) => role.value === storefrontRole) || ROLE_OPTIONS[0];

  // Dynamic categories computed from items
  const dynamicCategories = useMemo(() => {
    if (!items || items.length === 0) return ['Tất cả'];
    const unique = new Set(items.map(item => item?.category).filter(Boolean));
    return ['Tất cả', ...Array.from(unique)];
  }, [items]);

  const rollbackToGuest = (message) => {
    setStorefrontRole('guest');
    setStoredRole('guest');
    setHasAdminSession(false);
    setSessionRole('');
    setAdminMessage(message || 'Phiên admin không hợp lệ. Đã chuyển về chế độ Khách vãng lai.');
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

  const getERPUrl = () => {
    const envUrl = normalizeAbsoluteUrl(import.meta.env.VITE_ERP_URL);
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined') {
      const fromQuery = normalizeAbsoluteUrl(new URLSearchParams(window.location.search).get('erp_url'));
      if (fromQuery) return fromQuery;

      const referrer = normalizeAbsoluteUrl(window.document?.referrer);
      if (referrer) {
        try {
          const current = new URL(window.location.href);
          const source = new URL(referrer);
          if (source.origin !== current.origin) return source.origin;
        } catch {
          // ignore invalid referrer URL
        }
      }
    }

    return '';
  };

  const loadItems = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await publicApi.get('/items', { params: { company_id: id } });
      setItems(data || []);
      // KHÔNG tự động chọn sản phẩm đầu tiên — container "sản phẩm đang chọn"
      // sẽ hiển thị placeholder cho đến khi user thực sự bấm chọn sản phẩm.
      setSelectedItem(null);
      setSelectedImageIndex(0);
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

  const loadCassoAccounts = async (targetCompanyId) => {
    const cid = targetCompanyId || companyId;
    if (!cid) return;
    setCassoLoading(true);
    try {
      const { data } = await authApi.get('/api/casso/company-accounts/public', { params: { company_id: cid } });
      setCassoAccounts(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setCassoAccounts([]);
    } finally {
      setCassoLoading(false);
    }
  };

  const openCassoPayment = () => {
    loadCassoAccounts(companyId);
    setShowCassoModal(true);
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
      const price = getUnitPriceWithTax(item, 0.08);

      const matchCategory = activeCategory === 'Tất cả' || category.includes(normalizedCategory);
      const matchSearch = !term || name.includes(term) || code.includes(term);
      const matchPrice = price <= priceMax;

      if (matchCategory && matchSearch && matchPrice) {
        nextItems.push(item);
      }
    }

    if (sortBy === 'priceAsc') {
      nextItems.sort((a, b) => getUnitPriceWithTax(a, 0.08) - getUnitPriceWithTax(b, 0.08));
    } else if (sortBy === 'priceDesc') {
      nextItems.sort((a, b) => getUnitPriceWithTax(b, 0.08) - getUnitPriceWithTax(a, 0.08));
    } else if (sortBy === 'newest') {
      nextItems.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }

    return nextItems;
  }, [items, searchTerm, activeCategory, sortBy, priceMax]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + getUnitPriceWithTax(item, 0.08) * item.quantity, 0), [cart]);
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
      .sort((a, b) => getUnitPriceWithTax(a, 0.08) - getUnitPriceWithTax(b, 0.08))
      .slice(0, 2)
      .map((item) => `Giá tốt hôm nay: ${item.name} từ ${formatPrice(getUnitPriceWithTax(item, 0.08), selectedCurrency)}.`);

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
      // 1. Find or create partner by phone
      let orderPartnerId = null;
      try {
        const partnerResult = await findOrCreatePartner(companyId, {
          partner_name: checkoutForm.customerName,
          phone: checkoutForm.phone,
          address: checkoutForm.address
        });
        orderPartnerId = partnerResult?.partner?.id || partnerResult?.id || null;
      } catch (partnerErr) {
        // Partner creation is non-blocking - proceed without partner_id
        console.warn('Could not find/create partner:', partnerErr);
      }

      // 2. Build order payload with all 2-way sales fields
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
        taxRate: 0.08,
        discount_amount: discountAmount,
        coupon_code: couponCode.trim() || null,
        tax_rate: 8.00,
        tax_amount: Math.round(checkoutPreviewAmount * 0.08 / 1.08),
        shipping_fee: 0,
        payment_method: paymentMethod,
        payment_status: 'pending',
        sales_channel: 'storefront',
        partner_id: orderPartnerId
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
          return !previousMap.has(id) && order.loading_status === WAREHOUSE_STATUS_TYPES.pendingLoading;
        });

        const completedOrders = nextList.filter((order) => {
          const id = Number(order.id);
          const previous = previousMap.get(id);
          return previous && previous.loading_status !== WAREHOUSE_STATUS_TYPES.completed && order.loading_status === WAREHOUSE_STATUS_TYPES.completed;
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
      // Xử lý 401/403 âm thầm - không hiển thị lỗi, trả về mảng rỗng
      // Các endpoint này yêu cầu auth, nếu không có session thì silently bỏ qua
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
    if (!canUseRealtimeQueue) {
      setWarehouseQueue([]);
      setWarehouseLoading(false);
      setIsRealtimeConnecting(false);
      setIsRealtimeConnected(false);
      setLastRealtimeSync(null);
      return;
    }
    if (!companyId) return;

    previousQueueRef.current = new Map();
    firstQueueLoadRef.current = true;

    loadWarehouseQueue();
    const timer = setInterval(() => loadWarehouseQueue({ source: 'poll', keepLoadingState: false }), 60000);
    return () => clearInterval(timer);
  }, [companyId, canUseRealtimeQueue]);

  useEffect(() => {
    if (!canUseRealtimeQueue || !companyId) return;

    if (!storefrontToken) {
      setIsRealtimeConnecting(true);
      setIsRealtimeConnected(false);
      // Set timeout: nếu 15s không có token, chuyển sang "Mất kết nối"
      const timeout = setTimeout(() => {
        setIsRealtimeConnecting(false);
        setIsRealtimeConnected(false);
      }, 15000);
      return () => clearTimeout(timeout);
    }

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

      const targetRoles = Array.isArray(payload?.targetRoles) ? payload.targetRoles : [];
      const shouldNotifyCurrentRole = targetRoles.length === 0 || targetRoles.includes(storefrontRole) || (storefrontRole === 'admin' && targetRoles.includes('admin'));

      if (shouldNotifyCurrentRole) {
        const title = isWarehouseRole ? 'Đơn mới chờ xuất kho' : isSalesRole ? 'Đơn mới từ bán hàng' : 'Đơn mới từ bán hàng';
        setRolePopup({
          id: `rt-order-created-${Date.now()}`,
          title,
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
      const targetRoles = Array.isArray(payload?.targetRoles) ? payload.targetRoles : [];
      const shouldNotifyCurrentRole = targetRoles.length === 0 || targetRoles.includes(storefrontRole) || (storefrontRole === 'admin' && targetRoles.includes('admin'));

      if (shouldNotifyCurrentRole) {
        setRolePopup({
          id: `rt-status-${Date.now()}`,
          title: 'Cập nhật trạng thái đơn',
          message: `${voucherNumber}: ${statusLabel}.`
        });
      }

      if (isSalesRole && loadingStatus === WAREHOUSE_STATUS_TYPES.completed && Number.isFinite(voucherId)) {
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
      setLastRealtimeSync(null);
      
      // Không tự động xóa storefrontToken khi EventSource lỗi
      // Vì EventSource có thể lỗi do network glitch tạm thời
      // Session validation (Effect B) sẽ xử lý token expiry riêng
      // Khi token thực sự hết hạn, EventSource tự động reconnect sẽ thất bại
      // và Effect B sẽ phát hiện và xóa token nếu cần
      // Polling fallback vẫn chạy song song bất kể trạng thái WebSocket
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
  }, [companyId, canUseRealtimeQueue, storefrontToken, isAdminRole, isWarehouseRole, isSalesRole]);

  useEffect(() => {
    if (!rolePopup) return;
    const timer = setTimeout(() => setRolePopup(null), 5000);
    return () => clearTimeout(timer);
  }, [rolePopup]);

  const warehouseFilteredQueue = useMemo(() => {
    if (warehouseStatusFilter === 'all') return warehouseQueue;
    return warehouseQueue.filter((order) => order.loading_status === warehouseStatusFilter);
  }, [warehouseQueue, warehouseStatusFilter]);

  const queueStatusSummary = useMemo(() => {
    const summary = Object.fromEntries(WAREHOUSE_STATUS_SUMMARY_KEYS.map((status) => [status, 0]));

    warehouseQueue.forEach((order) => {
      const status = String(order?.loading_status || '').trim();
      if (summary[status] !== undefined) {
        summary[status] += 1;
      }
    });

    return summary;
  }, [warehouseQueue]);

  const getStatusBadgeClass = (status) => {
    const normalizedStatus = String(status || '').trim();
    return WAREHOUSE_STATUS_BADGE_CLASS[normalizedStatus] || WAREHOUSE_STATUS_BADGE_CLASS.default;
  };

  const getStatusCardClass = (status) => {
    const normalizedStatus = String(status || '').trim();
    return WAREHOUSE_STATUS_CARD_CLASS[normalizedStatus] || WAREHOUSE_STATUS_CARD_CLASS.default;
  };

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
      if (currentStatus === WAREHOUSE_STATUS_TYPES.pendingLoading) {
        await authApi.post(
          '/api/logistics/assign-truck',
          { companyId: Number(companyId), voucherId: Number(order.id), truckId: order?.truck_id || null },
          getAdminAuthConfig()
        );
      }

      if (currentStatus === WAREHOUSE_STATUS_TYPES.assigned || currentStatus === WAREHOUSE_STATUS_TYPES.pendingLoading) {
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

  // ──────────────────────────────────────────────────────────────
  // UNIFIED SINGLE-PAGE LAYOUT for all roles
  // No early returns — one layout adapts via role conditionals.
  // ──────────────────────────────────────────────────────────────

  return (
    <div className="page-shell min-h-screen lg:h-screen lg:overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="flex min-h-screen lg:h-screen flex-col">

        {/* ========== UPDATED HEADER ========== */}
        <header className="flex-shrink-0 border-b border-slate-200/70 bg-white/95 px-4 py-3 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Left: role badge + company id */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4 min-w-0">
              <span className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${ROLE_BADGE_CLASS[currentRole.value] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {currentRole.label}
              </span>
              <form onSubmit={handleCompanySubmit} className="flex flex-wrap items-center gap-2">
                <input
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  placeholder="Company ID"
                  className="w-28 min-w-[110px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none shadow-sm"
                />
                <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400">
                  Tải
                </button>
              </form>
              {canUseRealtimeQueue && (
                <WebSocketStatusHUD
                  className="hidden md:inline-flex"
                  isConnected={isRealtimeConnected}
                  isConnecting={isRealtimeConnecting}
                  lastSync={lastRealtimeSync}
                  pendingOrders={pendingRealtimeOrders}
                  onReconnect={() => {
                    // Trigger reconnect by forcing WebSocket effect to re-run
                    if (storefrontToken) {
                      setStorefrontToken(prev => prev);
                    }
                  }}
                />
              )}
            </div>

            {/* Right: lang/currency + cart button */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
              <div className="btn-group-wrap flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm w-full md:w-auto">
                <button type="button" onClick={() => setSelectedLang('VI')} className={`min-w-[64px] max-md:flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold ${selectedLang === 'VI' ? 'bg-emerald-500 text-slate-950' : 'text-slate-700 hover:bg-white'}`}>VI</button>
                <button type="button" onClick={() => setSelectedLang('EN')} className={`min-w-[64px] max-md:flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold ${selectedLang === 'EN' ? 'bg-emerald-500 text-slate-950' : 'text-slate-700 hover:bg-white'}`}>EN</button>
                <button type="button" onClick={() => setSelectedCurrency('VND')} className={`min-w-[70px] max-md:flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold ${selectedCurrency === 'VND' ? 'bg-emerald-500 text-slate-950' : 'text-slate-700 hover:bg-white'}`}>VND</button>
                <button type="button" onClick={() => setSelectedCurrency('USD')} className={`min-w-[70px] max-md:flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold ${selectedCurrency === 'USD' ? 'bg-emerald-500 text-slate-950' : 'text-slate-700 hover:bg-white'}`}>USD</button>
              </div>
              {canUseCart && (
                <button onClick={() => setShowMiniCart((prev) => !prev)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400">
                  <ShoppingCart size={16} /> {cartCount > 0 ? `(${cartCount})` : ''}
                </button>
              )}
              {ALLOW_ROLE_SWITCH && (
                <div className="btn-group-wrap flex flex-wrap overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm w-full md:w-auto">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => handleRoleChange(role.value)}
                      className={`min-w-[72px] max-md:flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold ${storefrontRole === role.value ? 'bg-emerald-500 text-slate-950' : 'text-slate-700 hover:bg-white'}`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ========== MAIN CONTENT GRID ========== */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-2 p-2 lg:h-[calc(100vh-44px)] lg:overflow-hidden storefront-grid">

          {/* ─── LEFT PANEL: Products ─── */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm">
            {/* Search + Sort row */}
            <div className="flex-shrink-0 flex items-center gap-2 border-b border-slate-100 p-2.5">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isSalesRole ? 'Tìm nhanh theo tên/mã hàng...' : 'Tìm sản phẩm...'}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 outline-none"
                />
              </label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none">
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            {/* Categories pills */}
            <div className="flex-shrink-0 flex flex-wrap gap-1 border-b border-slate-100 px-2.5 py-2">
              {dynamicCategories.map((item) => (
                <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${activeCategory === item ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50'}`}>
                  {item}
                </button>
              ))}
            </div>

            {/* Product List (scrollable) */}
            <div className="flex-1 overflow-y-auto p-2.5">
              {loading ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">Đang tải...</div>
              ) : filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-slate-500">{t('noProducts', selectedLang)}</div>
              ) : (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                  {filteredItems.map((item) => {
                    const isWishlisted = wishlist.includes(item.id);
                    return (
                      <ProductCard
                        key={item.id}
                        product={item}
                        onSelect={handleItemSelect}
                        onViewDetails={openQuickView}
                        onSecondaryAction={canUseCart ? undefined : handleViewStock}
                        onAction={canUseCart ? (currentItem) => addToCart(currentItem, 1) : undefined}
                        actionLabel={isSalesRole ? t('addToOrder', selectedLang) : t('buyNow', selectedLang)}
                        actionClassName="touch-target flex-1 bg-emerald-500 text-slate-950 rounded-lg text-[10px] font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-1.5"
                        secondaryLabel={canUseCart ? t('details', selectedLang) : 'Xem tồn kho'}
                        secondaryClassName="touch-target flex-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-semibold hover:bg-slate-200 transition flex items-center justify-center gap-1.5"
                        onToggleWishlist={(itemId) => toggleWishlist(itemId)}
                        isInWishlist={isWishlisted}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT PANEL: Role-specific ─── */}
          <aside className="overflow-y-auto space-y-2.5 pr-0.5 storefront-right-panel">

            {/* SALES ROLE — Cart + Checkout */}
            {isSalesRole && (
              <>
                {/* Cart Items */}
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900">{t('quickCart', selectedLang)}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{cartCount} {t('cartItems', selectedLang)}</span>
                  </div>
                  <div className="max-h-[30vh] space-y-1.5 overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <p className="text-xs text-slate-500">{t('emptyCart', selectedLang)}</p>
                    ) : (
                      cart.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-emerald-100 bg-white p-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className="truncate text-xs font-semibold text-slate-900">{entry.name}</p>
                            <p className="text-[10px] font-semibold text-slate-700">{formatPrice(Number(entry.price_sell || 0), selectedCurrency)}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <button type="button" onClick={() => updateCartQuantity(entry.id, -1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">-</button>
                            <span className="w-5 text-center text-[10px] font-semibold text-slate-800">{entry.quantity}</span>
                            <button type="button" onClick={() => updateCartQuantity(entry.id, 1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">+</button>
                            <div className="ml-auto text-[10px] font-semibold text-slate-700">{formatPrice(getUnitPriceWithTax(entry, 0.08) * entry.quantity, selectedCurrency)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Checkout Form */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <h3 className="text-sm font-bold text-slate-900">{t('checkout', selectedLang)}</h3>
                  {error && <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-[10px] text-rose-700">{error}</div>}
                  {success && <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-[10px] text-emerald-700"><CheckCircle2 size={12} />{success}</div>}

                  <form onSubmit={handleCheckoutSubmit} className="mt-2 space-y-2">
                    {hasCheckoutCart && (
                      <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-2 text-[10px] text-emerald-700">
                        Đơn hàng gồm {cart.length} sản phẩm ({cartCount} món).
                      </div>
                    )}
                    <div className="grid gap-2">
                      <label className="space-y-0.5 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1"><User size={10} />{t('customerName', selectedLang)}</span>
                        <input required value={checkoutForm.customerName} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                      </label>
                      <label className="space-y-0.5 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1"><Phone size={10} />{t('phone', selectedLang)}</span>
                        <input required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                      </label>
                      <label className="space-y-0.5 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1"><MapPin size={10} />{t('address', selectedLang)}</span>
                        <input required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                      </label>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-600"><BadgePercent size={10} /> {t('coupon', selectedLang)}</div>
                      <div className="mt-1 flex gap-1">
                        <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Nhập SAVE10" className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-900 outline-none" />
                        <button type="button" onClick={handleCouponApply} className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-slate-950">{t('apply', selectedLang)}</button>
                      </div>
                      {couponMessage && <p className="mt-1 text-[10px] text-emerald-700">{couponMessage}</p>}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-900">
                      <span>{t('total', selectedLang)}</span>
                      <span>{formatPrice(checkoutPreviewAmount, selectedCurrency)}</span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-600"><Building2 size={10} /> Phương thức thanh toán</div>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-900 outline-none">
                        <option value="cod">Tiền mặt (COD)</option>
                        <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                        <option value="casso">Chuyển khoản (Casso)</option>
                      </select>
                    </div>
                    <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">
                      {submitting ? 'Đang tạo đơn...' : 'Tạo hóa đơn'} <ArrowRight size={14} />
                    </button>
                    <button type="button" onClick={openCassoPayment} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {paymentMethod === 'casso' ? 'Xem tài khoản Casso' : 'Thanh toán chuyển khoản (Casso)'}
                    </button>
                  </form>
                </div>

                {/* Recent Orders preview */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900">{t('orderTrackingSales', selectedLang)}</h3>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      Mới: {queueStatusSummary[WAREHOUSE_STATUS_TYPES.pendingLoading]}
                    </span>
                  </div>
                  {warehouseQueue.length === 0 ? (
                    <p className="mt-1 text-[10px] text-slate-500">{t('noOrdersInQueue', selectedLang)}</p>
                  ) : (
                    <div className="mt-1.5 space-y-1">
                      {warehouseQueue.slice(0, 4).map((order) => (
                        <div key={`sales-track-${order.id}`} className={`rounded-lg border p-1.5 ${getStatusCardClass(order.loading_status)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[10px] font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getStatusBadgeClass(order.loading_status)}`}>
                              {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* GUEST ROLE — Single product checkout + Cart if has items */}
            {isGuestRole && (
              <>
                {hasCheckoutCart ? (
                  // Cart summary + checkout
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900">{t('quickCart', selectedLang)}</h3>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{cartCount} món</span>
                    </div>
                    <div className="max-h-[20vh] space-y-1 overflow-y-auto pr-1">
                      {cart.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                          <span className="truncate text-[10px] font-semibold text-slate-900">{entry.name} x{entry.quantity}</span>
                          <span className="text-[10px] font-semibold text-slate-700">{formatPrice(getUnitPriceWithTax(entry, 0.08) * entry.quantity, selectedCurrency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                      <span>{t('total', selectedLang)}</span>
                      <span>{formatPrice(checkoutPreviewAmount, selectedCurrency)}</span>
                    </div>
                  </div>
                ) : selectedItem ? (
                  // Single product quick-add
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="text-xs font-bold text-slate-900">{t('selectedProduct', selectedLang)}</h3>
                    <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="text-xs font-semibold text-slate-900">{selectedItem.name}</p>
                      <p className="text-[10px] text-slate-500">{selectedItem.code} - {formatPrice(getUnitPriceWithTax(selectedItem, 0.08), selectedCurrency)}/{selectedItem.unit || t('unit', selectedLang)}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button type="button" onClick={() => handleQuantityChange(Number(checkoutForm.quantity || 1) - 1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700">-</button>
                        <input type="number" min="1" value={checkoutForm.quantity} onChange={(e) => handleQuantityChange(e.target.value)} className="w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center text-xs text-slate-900 outline-none" />
                        <button type="button" onClick={() => handleQuantityChange(Number(checkoutForm.quantity || 1) + 1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-700">+</button>
                        <button onClick={() => addToCart(selectedItem, Number(checkoutForm.quantity || 1))} className="ml-auto rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-slate-950">{t('addToCart', selectedLang)}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                    {t('selectProduct', selectedLang)}
                  </div>
                )}

                {/* Checkout Form */}
                {canOrder && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="text-sm font-bold text-slate-900">{t('checkout', selectedLang)}</h3>
                    {error && <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-[10px] text-rose-700">{error}</div>}
                    {success && <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-[10px] text-emerald-700"><CheckCircle2 size={12} />{success}</div>}
                    <form onSubmit={handleCheckoutSubmit} className="mt-2 space-y-2">
                      <div className="grid gap-2">
                        <label className="space-y-0.5 text-[10px] text-slate-600">
                          <span className="flex items-center gap-1"><User size={10} />{t('customerName', selectedLang)}</span>
                          <input required value={checkoutForm.customerName} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                        </label>
                        <label className="space-y-0.5 text-[10px] text-slate-600">
                          <span className="flex items-center gap-1"><Phone size={10} />{t('phone', selectedLang)}</span>
                          <input required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                        </label>
                        <label className="space-y-0.5 text-[10px] text-slate-600">
                          <span className="flex items-center gap-1"><MapPin size={10} />{t('address', selectedLang)}</span>
                          <input required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                        </label>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-600"><BadgePercent size={10} /> {t('coupon', selectedLang)}</div>
                        <div className="mt-1 flex gap-1">
                          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Nhập SAVE10" className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-900 outline-none" />
                          <button type="button" onClick={handleCouponApply} className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-slate-950">{t('apply', selectedLang)}</button>
                        </div>
                        {couponMessage && <p className="mt-1 text-[10px] text-emerald-700">{couponMessage}</p>}
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                        <span>{t('total', selectedLang)}</span>
                        <span>{formatPrice(checkoutPreviewAmount, selectedCurrency)}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-600"><Building2 size={10} /> Phương thức thanh toán</div>
                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-900 outline-none">
                          <option value="cod">Tiền mặt (COD)</option>
                          <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                          <option value="casso">Chuyển khoản (Casso)</option>
                        </select>
                      </div>
                      <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">
                        {submitting ? 'Đang tạo đơn...' : t('checkout', selectedLang)} <ArrowRight size={14} />
                      </button>
                      <button type="button" onClick={openCassoPayment} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        {paymentMethod === 'casso' ? 'Xem tài khoản Casso' : 'Thanh toán chuyển khoản (Casso)'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Shipping estimate */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-1 text-xs text-slate-600"><Truck size={12} /> {t('shippingEstimate', selectedLang)}</div>
                  <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder={t('enterPostalCode', selectedLang)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 outline-none" />
                  <p className="mt-1 text-[10px] text-slate-500">{shippingEstimate}</p>
                </div>

                {/* Promo highlights */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <h3 className="text-xs font-bold text-slate-900">Ưu đãi</h3>
                  <div className="mt-1.5 space-y-1">
                    {promoHighlights.map((h, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-[10px] text-slate-600">{h}</div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ADMIN ROLE — Product Management + Orders */}
            {isAdminRole && (
              <>
                {adminMessage && (
                  <div className={`rounded-xl border p-2 text-[10px] ${hasAdminSession ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {adminMessage}
                  </div>
                )}
                {/* Product Form */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <h3 className="text-xs font-bold text-slate-900">{t('createUpdateProduct', selectedLang)}</h3>
                  <form onSubmit={handleAdminItemSubmit} className="mt-2 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={adminItemForm.code} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, code: e.target.value }))} placeholder={t('productCode', selectedLang)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                      <input value={adminItemForm.unit} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder={t('unitShort', selectedLang)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                    </div>
                    <input value={adminItemForm.name} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('productName', selectedLang)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                    <textarea value={adminItemForm.description} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t('description', selectedLang)} rows={1} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="number" min="0" step="1000" value={adminItemForm.price_sell} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, price_sell: e.target.value }))} placeholder={t('price', selectedLang)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                      <input type="number" min="0" value={adminItemForm.opening_quantity} onChange={(e) => setAdminItemForm((prev) => ({ ...prev, opening_quantity: e.target.value }))} placeholder={t('openingQuantity', selectedLang)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none" />
                    </div>
                    <input ref={adminImageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAdminImageFilesChange} />
                    <button type="button" onClick={handleAdminPickImages} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">
                      {adminImageFiles.length > 0 ? `${t('addImages', selectedLang)} (${adminImageFiles.length}/6)` : t('addImages', selectedLang)}
                    </button>
                    <div className="flex gap-1.5">
                      <button type="submit" disabled={adminBusy || !hasAdminSession} className="flex-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60">
                        {adminEditingCode ? t('save', selectedLang) : t('create', selectedLang)}
                      </button>
                      <button type="button" onClick={resetAdminItemForm} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">{t('reset', selectedLang)}</button>
                    </div>
                  </form>
                </div>

                {/* Orders tracking */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-slate-900">{t('orderTracking', selectedLang)}</h3>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      Mới: {queueStatusSummary[WAREHOUSE_STATUS_TYPES.pendingLoading]}
                    </span>
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {warehouseQueue.length === 0 ? (
                      <p className="py-2 text-center text-[10px] text-slate-500">{t('noOrders', selectedLang)}</p>
                    ) : (
                      warehouseQueue.slice(0, 8).map((order) => (
                        <div key={`admin-track-${order.id}`} className={`flex items-center justify-between rounded-lg border px-2 py-1 ${getStatusCardClass(order.loading_status)}`}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                            <p className="text-[9px] text-slate-500">{getOrderDisplayDate(order)}</p>
                          </div>
                          <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getStatusBadgeClass(order.loading_status)}`}>
                            {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Product catalog */}
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <h3 className="text-xs font-bold text-slate-900">{t('productCatalog', selectedLang)}</h3>
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="py-2 text-center text-[10px] text-slate-500">{t('noProducts', selectedLang)}</p>
                    ) : (
                      items.slice(0, 20).map((item) => (
                        <div key={item.id || item.code} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[10px] font-semibold text-slate-900">{item.code} - {item.name}</p>
                            <p className="text-[9px] text-slate-500">{formatPrice(getUnitPriceWithTax(item, 0.08), selectedCurrency)} • {item.unit || t('unit', selectedLang)}</p>
                          </div>
                          <div className="ml-1 flex gap-0.5">
                            <button type="button" onClick={() => fillAdminFormFromItem(item)} className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] font-semibold text-slate-700 hover:bg-slate-100">{t('editAction', selectedLang)}</button>
                            <button type="button" onClick={() => handleAdminDeleteItem(item.code)} className="rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[9px] font-semibold text-rose-700 hover:bg-rose-100">{t('deleteAction', selectedLang)}</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {/* WAREHOUSE ROLE — Orders + actions */}
            {isWarehouseRole && (
              <>
                {!hasAdminSession ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">{t('noSessionFromERP', selectedLang)}</div>
                ) : (
                  <>
                    {/* Filter */}
                    <div className="flex flex-wrap gap-1">
                      {WAREHOUSE_STATUS_OPTIONS.map((status) => (
                        <button key={status.value} onClick={() => setWarehouseStatusFilter(status.value)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${warehouseStatusFilter === status.value ? 'bg-sky-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-sky-50'}`}>
                          {status.label}
                        </button>
                      ))}
                    </div>

                    {/* Orders list */}
                    <div className="rounded-2xl border border-sky-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-bold text-slate-900">{t('warehouseTracking', selectedLang)}</h3>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                            Mới: {queueStatusSummary[WAREHOUSE_STATUS_TYPES.pendingLoading]}
                          </span>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                            {warehouseQueue.filter((o) => o.loading_status !== WAREHOUSE_STATUS_TYPES.completed).length} {t('pendingOrders', selectedLang)}
                          </span>
                        </div>
                      </div>
                      {warehouseLoading ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-[10px] text-slate-500">{t('loadingQueue', selectedLang)}</div>
                      ) : warehouseFilteredQueue.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-[10px] text-slate-500">{t('noOrdersWithFilter', selectedLang)}</div>
                      ) : (
                        <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-0.5">
                          {warehouseFilteredQueue.slice(0, 20).map((order) => {
                            const isSelected = selectedWarehouseOrder?.id === order.id;
                            return (
                              <button
                                key={order.id}
                                type="button"
                                onClick={() => setSelectedWarehouseOrder(order)}
                                className={`w-full rounded-lg border p-2 text-left transition ${isSelected ? 'border-sky-400 bg-sky-50 shadow-sm' : `${getStatusCardClass(order.loading_status)} hover:border-sky-200 hover:bg-sky-50/50`}`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <p className="truncate text-[10px] font-semibold text-slate-900">{order.voucherNumber || `Đơn #${order.id}`}</p>
                                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getStatusBadgeClass(order.loading_status)}`}>
                                    {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[9px] text-slate-500">{getOrderDisplayDate(order)} • {order.lines?.length || 0} dòng</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Selected order details */}
                    {selectedWarehouseOrder && (
                      <div className="rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-xs font-bold text-slate-900">{selectedWarehouseOrder.voucherNumber || `Đơn #${selectedWarehouseOrder.id}`}</h4>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getStatusBadgeClass(selectedWarehouseOrder.loading_status)}`}>
                            {WAREHOUSE_STATUS_LABEL[selectedWarehouseOrder.loading_status] || selectedWarehouseOrder.loading_status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{selectedWarehouseOrder.description || 'Đơn web'} • {getOrderDisplayDate(selectedWarehouseOrder)}</p>
                        <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
                          {selectedWarehouseOrder.lines?.length > 0 ? selectedWarehouseOrder.lines.slice(0, 10).map((line, idx) => (
                            <div key={`${selectedWarehouseOrder.id}-${line.item_id || idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1">
                              <span className="truncate text-[10px] font-semibold text-slate-800">{line.item_code} - {line.item_name}</span>
                              <span className="text-[10px] font-bold text-slate-900">{Number(line.quantity || 0).toLocaleString('vi-VN')}</span>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-500">{t('noOrderLines', selectedLang)}</p>
                          )}
                        </div>
                        {selectedWarehouseOrder.loading_status !== WAREHOUSE_STATUS_TYPES.completed && (
                          <button type="button" onClick={() => handleWarehouseComplete(selectedWarehouseOrder)} className="mt-2 w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-[10px] font-semibold text-slate-950 hover:bg-emerald-400">
                            {t('completeWarehouseOrder', selectedLang)}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

      {/* ========== MODALS / POPUPS ========== */}

      {rolePopup && (
        <div className="fixed right-4 top-14 z-50 w-72 rounded-xl border border-blue-200 bg-white p-3 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900">{rolePopup.title}</p>
              <p className="mt-1 text-xs text-slate-600">{rolePopup.message}</p>
            </div>
            <button type="button" onClick={() => setRolePopup(null)} className="text-slate-400 hover:text-slate-600 text-xs">x</button>
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

      {showMiniCart && canUseCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{t('quickCart', selectedLang)}</h2>
              <button onClick={() => setShowMiniCart(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-500">
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-xs text-slate-500">{t('emptyCart', selectedLang)}</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{formatPrice(getUnitPriceWithTax(item, 0.08), selectedCurrency)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateCartQuantity(item.id, -1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs">-</button>
                      <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.id, 1)} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>{t('total', selectedLang)}</span>
                <span>{formatPrice(checkoutPreviewAmount, selectedCurrency)}</span>
              </div>
              <button onClick={handleMobileCheckout} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">{t('checkout', selectedLang)}</button>
            </div>
          </div>
        </div>
      )}

      <Footer companyId={companyId} />

      <FloatingCartBar
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onCheckout={handleMobileCheckout}
        onClose={() => setShowMiniCart(false)}
        subtotal={cartSubtotal}
        itemCount={cartCount}
      />

      {showCassoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Thanh toán chuyển khoản</h2>
              <button onClick={() => setShowCassoModal(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-500">
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {cassoLoading ? (
                <p className="text-xs text-slate-500">Đang tải thông tin tài khoản...</p>
              ) : cassoAccounts.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa cấu hình tài khoản nhận tiền cho công ty này.</p>
              ) : (
                cassoAccounts.map((acc, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-900">{acc.bank_name || 'Ngân hàng'}</p>
                    <p className="text-[11px] text-slate-700">Số tài khoản: <span className="font-semibold">{acc.account_number}</span></p>
                    <p className="text-[11px] text-slate-700">Chủ tài khoản: {acc.owner_name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Nội dung chuyển khoản gợi ý: <span className="font-semibold text-slate-700">{salesOrderIds?.[0] ? `ORD-${salesOrderIds[0]}` : 'Mã đơn hàng'}</span></p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-700">
              Lưu ý: Hệ thống sẽ tự động đối soát khi nhận được giao dịch từ Casso. Vui lòng giữ đúng nội dung chuyển khoản để đơn hàng được xử lý tự động.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}