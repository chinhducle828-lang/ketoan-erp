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
  Star,
  Truck,
  User,
  X
} from 'lucide-react';


// Normalize API base URL: allow env override, ensure protocol, trim trailing slash,
// and warn when using localhost from an HTTPS-served storefront (PNA/CORS issue).
let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://dazzling-grace-production-03a5.up.railway.app';
if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}
API_BASE_URL = API_BASE_URL.replace(/\/$/, '');
if (API_BASE_URL.includes('localhost') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
  console.error('[STOREFRONT] VITE_API_BASE_URL points to localhost while storefront is served over HTTPS — requests will be blocked by browser Private Network Access. Set VITE_API_BASE_URL to your backend public URL.');
}
const ALLOW_ROLE_SWITCH = String(import.meta.env.VITE_ALLOW_ROLE_SWITCH || 'false').toLowerCase() === 'true';

const publicApi = axios.create({
  baseURL: `${API_BASE_URL}/api/public`,
  withCredentials: false
});

// authApi uses credentials (HttpOnly refresh cookie) for server-side session flows
const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

const CATEGORY_OPTIONS = ['Tất cả', 'Gạch', 'Sơn', 'Xi măng', 'Thép', 'Ống nước'];
const SORT_OPTIONS = [
  { value: 'featured', label: 'Nổi bật' },
  { value: 'priceAsc', label: 'Giá thấp → cao' },
  { value: 'priceDesc', label: 'Giá cao → thấp' },
  { value: 'newest', label: 'Mới nhất' }
];

const ROLE_OPTIONS = [
  { value: 'guest', label: 'Khách vãng lai' },
  { value: 'admin', label: 'Admin bán hàng' },
  { value: 'nv_banhang', label: 'Nhân viên bán hàng' },
  { value: 'nv_kho', label: 'Nhân viên kho' }
];

const ROLE_BADGE_CLASS = {
  guest: 'bg-violet-100 text-violet-700 border-violet-200',
  admin: 'bg-amber-100 text-amber-700 border-amber-200',
  nv_banhang: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  nv_kho: 'bg-sky-100 text-sky-700 border-sky-200'
};

const WAREHOUSE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'pending_loading', label: 'Chờ xuất kho' },
  { value: 'assigned', label: 'Đã phân xe' },
  { value: 'delivering', label: 'Đang giao hàng' }
];

const WAREHOUSE_STATUS_LABEL = {
  pending_loading: 'Chờ xuất kho',
  assigned: 'Đã phân xe',
  delivering: 'Đang giao hàng',
  completed: 'Đã hoàn thành'
};

const normalizeAbsoluteUrl = (value) => {
  if (!value) return '';
  let raw = String(value).trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

const buildErpLoginUrl = (baseUrl, companyId, role) => {
  const url = new URL(baseUrl);
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/login';
  }
  if (companyId) url.searchParams.set('company_id', companyId);
  if (role) url.searchParams.set('role', role);
  return url.toString();
};

const isSessionAllowedForRole = (targetRole, sessionRole) => {
  if (!targetRole || targetRole === 'guest') return true;
  if (!sessionRole) return false;
  if (targetRole === 'admin') return sessionRole === 'admin';
  if (targetRole === 'nv_kho') return sessionRole === 'nv_kho' || sessionRole === 'admin';
  if (targetRole === 'nv_banhang') return sessionRole === 'nv_banhang' || sessionRole === 'admin';
  return false;
};

const getRoleDisplayName = (role) => {
  if (role === 'admin') return 'admin';
  if (role === 'nv_kho') return 'nhân viên kho';
  if (role === 'nv_banhang') return 'nhân viên bán hàng';
  return 'người dùng';
};

export default function StorefrontPage() {
  const [companyId, setCompanyId] = useState(() => localStorage.getItem('shopCompanyId') || '');
  const [storefrontRole, setStorefrontRole] = useState(() => localStorage.getItem('storefrontRole') || 'guest');
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
  const canOrder = isSalesRole || isGuestRole;
  const canUseCart = isSalesRole || isGuestRole;
  const canManageItems = isAdminRole;
  const currentRole = ROLE_OPTIONS.find((role) => role.value === storefrontRole) || ROLE_OPTIONS[0];

  const rollbackToGuest = (message) => {
    setStorefrontRole('guest');
    localStorage.setItem('storefrontRole', 'guest');
    setHasAdminSession(false);
    setSessionRole('');
    setAdminMessage(message || 'Phiên admin không hợp lệ. Đã chuyển về chế độ Khách vãng lai.');
  };

  const isExplicitNonAdminRole = (roleCode) => {
    const normalized = String(roleCode || '').trim().toLowerCase();
    return normalized !== '' && normalized !== 'admin';
  };

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

  const hasCartItems = cart.length > 0;
  const getUnitPrice = (item) => Number(item?.price_sell || 0);
  const getOrderAmount = (item, quantity) => Number((getUnitPrice(item) * Math.max(Number(quantity) || 1, 1)).toFixed(2));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramCompanyId = params.get('company_id') || params.get('companyId');
    const paramRole = params.get('role') || params.get('storefront_role');
    const erpToken = params.get('erp_token');

    if (paramRole && ROLE_OPTIONS.some((item) => item.value === paramRole)) {
      setStorefrontRole(paramRole);
      localStorage.setItem('storefrontRole', paramRole);
    }

    if (paramCompanyId) {
      setCompanyId(paramCompanyId);
      localStorage.setItem('shopCompanyId', paramCompanyId);
    }

    if (erpToken) {
      (async () => {
        setAuthenticatingAdmin(true);
        setAdminSessionChecked(false);
        try {
          await authApi.post('/api/auth/external-login', { erp_token: erpToken, company_id: paramCompanyId, role: paramRole });
          // remove token from URL to avoid leakage
          params.delete('erp_token');
          const nextQuery = params.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
          window.history.replaceState({}, '', nextUrl);

          // validate server-side session via cookie
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
        setAuthenticatingAdmin(true);
        setAdminSessionChecked(false);
        const { data } = await authApi.get('/api/auth/me');
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
        if (storefrontRole === 'admin') {
          setAdminMessage('Không nhận được phiên admin từ ERP. Giữ nguyên chế độ admin và thử xác thực lại.');
          setHasAdminSession(false);
          setSessionRole('');
        } else {
          setAdminMessage('Không nhận được phiên từ ERP. Vui lòng mở storefront từ ERP để tiếp tục thao tác theo vai trò hiện tại.');
          setHasAdminSession(false);
          setSessionRole('');
        }
      } finally {
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

  const handleQuantityChange = (rawValue) => {
    const nextQuantity = Math.max(Number(rawValue) || 1, 1);
    setCheckoutForm((prev) => ({
      ...prev,
      quantity: String(nextQuantity),
      amount: String(getOrderAmount(selectedItem, nextQuantity))
    }));
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
    const term = searchTerm.toLowerCase();
    return items.filter((item) => {
      const matchCategory = activeCategory === 'Tất cả' || (item.category || 'Phổ biến').toLowerCase().includes(activeCategory.toLowerCase());
      const matchSearch = !term || item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term);
      const matchPrice = Number(item.price_sell || 0) <= priceMax;
      return matchCategory && matchSearch && matchPrice;
    }).sort((a, b) => {
      if (sortBy === 'priceAsc') return Number(a.price_sell || 0) - Number(b.price_sell || 0);
      if (sortBy === 'priceDesc') return Number(b.price_sell || 0) - Number(a.price_sell || 0);
      if (sortBy === 'newest') return Number(b.id || 0) - Number(a.id || 0);
      return 0;
    });
  }, [items, searchTerm, activeCategory, sortBy, priceMax]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.price_sell || 0) * item.quantity, 0), [cart]);
  const discountAmount = couponCode.toUpperCase() === 'SAVE10' ? cartSubtotal * 0.1 : 0;
  const totalAfterDiscount = cartSubtotal - discountAmount;
  const shippingEstimate = shippingCode.trim().length >= 4 ? 'Miễn phí vận chuyển trong 24h' : 'Nhập mã bưu chính để xem phí ship';
  const hasCheckoutCart = cart.length > 0;
  const checkoutPreviewAmount = hasCheckoutCart
    ? Number(totalAfterDiscount.toFixed(2))
    : Number(checkoutForm.amount || getOrderAmount(selectedItem, checkoutForm.quantity));
  const promoHighlights = useMemo(() => {
    const fromDescriptions = items
      .filter((item) => typeof item.description === 'string' && item.description.trim().length > 0)
      .slice(0, 2)
      .map((item) => item.description.trim());

    if (fromDescriptions.length > 0) {
      return fromDescriptions;
    }

    const fromProducts = [...items]
      .sort((a, b) => Number(a.price_sell || 0) - Number(b.price_sell || 0))
      .slice(0, 2)
      .map((item) => `Giá tốt hôm nay: ${item.name} từ ${Number(item.price_sell || 0).toLocaleString('vi-VN')} ₫.`);

    if (fromProducts.length > 0) {
      return fromProducts;
    }

    return [
      'Ưu đãi sẽ hiển thị ngay khi doanh nghiệp cập nhật mô tả sản phẩm trong ERP.',
      'Bạn có thể chỉnh nội dung này bằng mô tả trong danh mục sản phẩm.'
    ];
  }, [items]);

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
    localStorage.setItem('storefrontRole', nextRole);
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

  const loadWarehouseQueue = async () => {
    if (!companyId) {
      setWarehouseQueue([]);
      return;
    }

    setWarehouseLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/logistics/queue-details`, {
        params: { company_id: companyId },
        ...getAdminAuthConfig()
      });

      const nextList = Array.isArray(data) ? data : [];
      const nextMap = new Map(nextList.map((order) => [Number(order.id), order]));
      const previousMap = previousQueueRef.current;

      if (!firstQueueLoadRef.current) {
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
            message: `${completedOrders[0].voucher_number || 'Đơn hàng'} đã được kho hoàn thành.`
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
              message: `${completedForSales[0].voucher_number || 'Đơn hàng'} đã được kho xử lý hoàn tất.`
            });
          }
        }
      }

      previousQueueRef.current = nextMap;
      firstQueueLoadRef.current = false;
      setWarehouseQueue(nextList);
    } catch (err) {
      if (isWarehouseRole) {
        setError(err.response?.data?.error || 'Không thể tải danh sách chờ xuất kho.');
      }
    } finally {
      setWarehouseLoading(false);
    }
  };

  useEffect(() => {
    if (!(isWarehouseRole || isAdminRole || isSalesRole)) return;
    if (!companyId) return;

    previousQueueRef.current = new Map();
    firstQueueLoadRef.current = true;

    loadWarehouseQueue();
    const timer = setInterval(loadWarehouseQueue, 15000);
    return () => clearInterval(timer);
  }, [companyId, isWarehouseRole, isAdminRole, isSalesRole]);

  useEffect(() => {
    if (!rolePopup) return;
    const timer = setTimeout(() => setRolePopup(null), 5000);
    return () => clearTimeout(timer);
  }, [rolePopup]);

  const warehouseFilteredQueue = useMemo(() => {
    if (warehouseStatusFilter === 'all') return warehouseQueue;
    return warehouseQueue.filter((order) => order.loading_status === warehouseStatusFilter);
  }, [warehouseQueue, warehouseStatusFilter]);

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
        await axios.put(
          `${API_BASE_URL}/api/items/${encodeURIComponent(adminEditingCode)}`,
          payload,
          getAdminAuthConfig()
        );
        setAdminMessage('Cập nhật sản phẩm thành công.');
      } else {
        await axios.post(`${API_BASE_URL}/api/items`, payload, getAdminAuthConfig());
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
      await axios.delete(
        `${API_BASE_URL}/api/items/${encodeURIComponent(itemCode)}`,
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
      await axios.post(
        `${API_BASE_URL}/api/logistics/mark-completed`,
        { companyId: Number(companyId), voucherId: Number(order.id) },
        getAdminAuthConfig()
      );
      setRolePopup({
        id: `warehouse-completed-${Date.now()}`,
        title: 'Đã xác nhận hoàn thành',
        message: `${order.voucher_number || 'Đơn hàng'} đã được cập nhật hoàn thành.`
      });
      loadWarehouseQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể cập nhật trạng thái hoàn thành đơn.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
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
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">Mua vật liệu xây dựng nhanh chóng</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Tìm kiếm gạch, sơn, xi măng, thép và vật tư xây dựng giá tốt trên cùng một trang. Đặt hàng nhanh, giao hàng tận công trình.</p>
                {isGuestRole && (
                  <p className="mt-2 max-w-2xl text-sm font-medium text-violet-700">Bạn đang ở chế độ khách vãng lai, có thể xem sản phẩm và đặt hàng nhanh mà không cần đăng nhập.</p>
                )}
                {isSalesRole && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">POS Mode: Quầy bán hàng trực tiếp</p>
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
            {CATEGORY_OPTIONS.map((item) => (
              <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-full px-4 py-2 text-sm ${activeCategory === item ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'}`}>
                {item}
              </button>
            ))}
            <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-4 py-2 text-sm text-slate-600 hover:border-emerald-500">
              <SlidersHorizontal size={14} /> Lọc theo vật liệu
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
                      <p className="text-sm text-slate-500">{Number(item.price_sell || 0).toLocaleString('vi-VN')} ₫</p>
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
              <span className="font-semibold text-slate-900">{cartSubtotal.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
        )}

        <section className={`mt-6 grid gap-6 ${isSalesRole ? 'xl:grid-cols-[1.55fr_1fr]' : 'xl:grid-cols-[1.9fr_1fr]'}`}>
          <div className="space-y-6">
            {isSalesRole && (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">POS Counter</p>
                    <p className="text-sm text-emerald-800">Thêm sản phẩm vào hóa đơn ở bên trái, thao tác chốt đơn ở panel phải.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                    <ShoppingBag size={14} /> {cartCount} món • {checkoutPreviewAmount.toLocaleString('vi-VN')} ₫
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                    <Building2 size={16} /> Vật tư công trình
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">Chọn vật liệu chất lượng, giao nhanh</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Duyệt vật liệu xây dựng theo danh mục, so sánh giá và hoàn tất đơn hàng nhanh chóng ngay trên web.</p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-slate-200/40 p-5 text-sm text-slate-700">
                  <div className="flex items-center gap-2 text-slate-900"><Truck size={16} /> Giao hàng 24h</div>
                  <div className="mt-3 flex items-center gap-2 text-slate-900"><BadgePercent size={16} /> Giảm giá đặc biệt</div>
                  <div className="mt-3 flex items-center gap-2 text-slate-900"><CheckCircle2 size={16} /> Hỗ trợ đổi trả</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-6 shadow-xl shadow-slate-300/20 backdrop-blur">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="relative rounded-[24px] border border-slate-200 bg-slate-100/90 p-4">
                  <Search className="pointer-events-none absolute left-4 top-4 text-slate-500" size={18} />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm sản phẩm, danh mục..."
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
                    <p className="text-xs text-slate-500">Đến {priceMax.toLocaleString('vi-VN')} ₫</p>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {CATEGORY_OPTIONS.map((item) => (
                <button key={item} onClick={() => setActiveCategory(item)} className={`rounded-[24px] border px-4 py-4 text-left text-sm text-slate-700 transition ${activeCategory === item ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-200 bg-slate-100/90 hover:border-emerald-500'}`}>
                    <span className="block font-semibold text-slate-900">{item}</span>
                    <span className="mt-2 block text-xs text-slate-500">Khám phá danh mục {item === 'Tất cả' ? 'toàn bộ' : item.toLowerCase()}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.length === 0 ? (
                <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-slate-50/90 p-8 text-center text-slate-500">Không có sản phẩm phù hợp. Thử thay đổi từ khóa hoặc bộ lọc.</div>
              ) : filteredItems.map((item) => {
                const isWishlisted = wishlist.includes(item.id);
                return (
                  <div key={item.id} className="group rounded-[24px] border border-slate-200 bg-slate-100/90 p-4 transition hover:border-emerald-500/40">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-emerald-300">{item.category || 'Phổ biến'}</span>
                      <button onClick={() => toggleWishlist(item.id)} className={`rounded-full p-2 ${isWishlisted ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-100 text-slate-500'}`}>
                        <Heart size={16} />
                      </button>
                    </div>
                    <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-100/70 p-6 text-center">
                      {item.image_urls?.length > 0 || item.image_url ? (
                        <img src={item.image_urls?.[0] || item.image_url} alt={item.name} className="mx-auto h-32 w-full max-w-[220px] rounded-[24px] object-cover" />
                      ) : (
                        <Package size={28} className="mx-auto text-emerald-300" />
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                      <h4 className="text-base font-bold text-slate-900">{item.name}</h4>
                      <p className="mt-1 text-sm text-slate-500">{item.code} • {item.unit || 'Đơn vị'}</p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-300">{Number(item.price_sell || 0).toLocaleString('vi-VN')} ₫</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                        <Star size={14} className="text-amber-400" /> 4.8 • 128 đánh giá
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button onClick={() => openQuickView(item)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:border-emerald-500/40">Chi tiết</button>
                      {canUseCart ? (
                        <button onClick={() => addToCart(item, 1)} className="rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">{isSalesRole ? 'Thêm vào hóa đơn' : 'Đặt mua'}</button>
                      ) : (
                        <button onClick={() => handleItemSelect(item)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Xem tồn kho</button>
                      )}
                    </div>
                  </div>
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
                        <div className="rounded-lg border border-slate-200 bg-white p-2">Giá tham chiếu: {Number(selectedItem.price_sell || 0).toLocaleString('vi-VN')} ₫</div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2">Loại hàng: {selectedItem.category || 'Phổ biến'}</div>
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
              ) : hasCheckoutCart ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Vật liệu đã chọn</p>
                        <p className="font-semibold text-slate-900">{cart.length} sản phẩm trong giỏ</p>
                        <p className="mt-1 text-xs text-slate-500">Số lượng tổng: {cartCount} món</p>
                      </div>
                      <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{checkoutPreviewAmount.toLocaleString('vi-VN')} ₫</div>
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
                              <p className="text-xs font-semibold text-slate-700">{Number(entry.price_sell || 0).toLocaleString('vi-VN')} ₫</p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <button type="button" onClick={() => updateCartQuantity(entry.id, -1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">-</button>
                              <span className="w-7 text-center text-sm font-semibold text-slate-800">{entry.quantity}</span>
                              <button type="button" onClick={() => updateCartQuantity(entry.id, 1)} className="rounded-lg border border-slate-200 px-2 py-0.5 text-sm text-slate-700">+</button>
                              <div className="ml-auto text-xs font-semibold text-slate-700">
                                {(Number(entry.price_sell || 0) * entry.quantity).toLocaleString('vi-VN')} ₫
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 border-t border-slate-200 pt-2 text-right text-sm font-semibold text-slate-800">
                        Thành tiền: {checkoutPreviewAmount.toLocaleString('vi-VN')} ₫
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Truck size={15} /> Ước tính phí ship</div>
                    <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder="Mã bưu chính" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                    <p className="mt-2 text-xs text-slate-500">{shippingEstimate}</p>
                  </div>
                </div>
              ) : selectedItem ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Vật liệu chọn</p>
                        <p className="font-semibold text-slate-900">{selectedItem.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Đơn giá: {getUnitPrice(selectedItem).toLocaleString('vi-VN')} ₫/{selectedItem.unit || 'đơn vị'}</p>
                      </div>
                      <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{Number(selectedItem.price_sell || 0).toLocaleString('vi-VN')} ₫</div>
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
                          Thành tiền: {Number(checkoutForm.amount || 0).toLocaleString('vi-VN')} ₫
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-300"><Clock3 size={15} /> Flash sale còn</div>
                    <div className="mt-1.5 text-xs text-slate-500">03:12:47</div>
                    <button onClick={() => addToCart(selectedItem, Number(checkoutForm.quantity || 1))} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Thêm vào giỏ ({checkoutForm.quantity || 1})</button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Truck size={15} /> Ước tính phí ship</div>
                    <input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} placeholder="Mã bưu chính" className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                    <p className="mt-2 text-xs text-slate-500">{shippingEstimate}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-500">Chọn một sản phẩm để xem thông tin chi tiết.</div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200/70 bg-slate-100/70 p-4 shadow-xl shadow-slate-300/20 backdrop-blur">
              <h3 className="text-lg font-bold text-slate-900">Ưu đãi vật liệu</h3>
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
                <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><User size={14} />Tên khách</span><input required value={checkoutForm.customerName} onChange={(e) => setCheckoutForm({ ...checkoutForm, customerName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><Phone size={14} />Số điện thoại</span><input required value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              </div>
              <label className="space-y-1 text-sm text-slate-600"><span className="flex items-center gap-2"><MapPin size={14} />Địa chỉ</span><input required value={checkoutForm.address} onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600"><span>Số lượng</span><input type="number" min="1" value={hasCheckoutCart ? cartCount : checkoutForm.quantity} onChange={(e) => !hasCheckoutCart && handleQuantityChange(e.target.value)} readOnly={hasCheckoutCart} className="w-full rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
                <label className="space-y-1 text-sm text-slate-600"><span>Giá trị</span><input type="number" min="0" value={checkoutPreviewAmount} readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 text-sm text-slate-900 outline-none" /></label>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                <div className="flex items-center gap-2 text-sm text-slate-600"><BadgePercent size={14} /> Mã giảm giá</div>
                <div className="mt-3 flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Nhập SAVE10" className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none" />
                  <button type="button" onClick={handleCouponApply} className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Áp dụng</button>
                </div>
                {couponMessage && <p className="mt-2 text-sm text-emerald-300">{couponMessage}</p>}
              </div>
              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">{submitting ? 'Đang tạo đơn...' : isSalesRole ? 'Tạo hóa đơn POS' : 'Đặt hàng ngay'} <ArrowRight size={16} /></button>
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-5 shadow-xl shadow-slate-300/20 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Đánh giá & nhận xét</h3>
              <span className="text-sm text-slate-500">4.8/5 • 128 đánh giá</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { name: 'Minh', text: 'Mua gạch và xi măng nhanh, dịch vụ giao hàng tốt.', rating: 5 },
                { name: 'Lan', text: 'Vật liệu đầy đủ, giá rõ ràng và đặt hàng dễ dàng.', rating: 5 },
                { name: 'Huy', text: 'Đã đặt hàng thép, giao công trình đúng hạn.', rating: 4 }
              ].map((review) => (
                <div key={review.name} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{review.name}</span>
                    <span className="flex items-center gap-1 text-amber-400">{Array.from({ length: review.rating }).map((_, idx) => <Star key={idx} size={14} />)}</span>
                  </div>
                    <p className="mt-2 text-sm text-slate-500">{review.text}</p>
                </div>
              ))}
            </div>
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
                        <p className="truncate text-sm font-semibold text-slate-900">{order.voucher_number || `Đơn #${order.id}`}</p>
                        <p className="text-xs text-slate-500">{order.description || 'Đơn web'}</p>
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
                        <p className="text-xs text-slate-500">{Number(item.price_sell || 0).toLocaleString('vi-VN')} ₫ • {item.unit || 'Đơn vị'} • SL nhập: {Number(item.opening_quantity || 0).toLocaleString('vi-VN')}</p>
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
                        <p className="text-sm font-semibold text-slate-900">{order.voucher_number || `Đơn #${order.id}`}</p>
                        <p className="text-xs text-slate-500">{order.description || 'Đơn web'} • Trạng thái: {WAREHOUSE_STATUS_LABEL[order.loading_status] || order.loading_status}</p>
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
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-50/90 p-4">
            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200/70 bg-slate-100 p-5 shadow-2xl shadow-slate-300/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Xem nhanh</h3>
                <button onClick={() => setShowQuickView(false)} className="rounded-full bg-slate-100 p-2 text-slate-600"><X size={16} /></button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/90 p-4 text-center">
                  <div className="relative rounded-[20px] border border-slate-200 bg-white p-3">
                    {quickViewCurrentImage ? (
                      <img src={quickViewCurrentImage} alt={quickViewItem.name} className="mx-auto h-40 w-full rounded-[18px] object-cover" />
                    ) : (
                      <Package size={32} className="mx-auto my-16 text-emerald-300" />
                    )}
                    {quickViewImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={showQuickViewPrevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-700"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={showQuickViewNextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-700"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}
                  </div>
                  {quickViewImages.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {quickViewImages.map((src, index) => (
                        <button
                          type="button"
                          key={`${src}-${index}`}
                          onClick={() => setQuickViewImageIndex(index)}
                          className={`overflow-hidden rounded-2xl border ${quickViewImageIndex === index ? 'border-emerald-500' : 'border-slate-200'}`}
                        >
                          <img src={src} alt={`Ảnh ${index + 1}`} className="h-14 w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">{quickViewItem.category || 'Phổ biến'}</p>
                  <h4 className="mt-2 text-2xl font-black text-slate-900">{quickViewItem.name}</h4>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{quickViewDescription}</p>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                    <span className="text-sm text-slate-500">Giá bán</span>
                    <span className="font-semibold text-emerald-300">{Number(quickViewItem.price_sell || 0).toLocaleString('vi-VN')} ₫</span>
                  </div>
                  {quickViewImages.length > 1 && <p className="mt-3 text-xs text-slate-500">Đang xem ảnh {quickViewImageIndex + 1}/{quickViewImages.length}</p>}
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => { handleItemSelect(quickViewItem); setShowQuickView(false); }} className="flex-1 rounded-2xl border border-slate-200 bg-slate-100/90 px-3 py-2.5 text-sm text-slate-700">Xem chi tiết</button>
                    {canUseCart ? (
                      <button onClick={() => { addToCart(quickViewItem, 1); setShowQuickView(false); }} className="flex-1 rounded-2xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-slate-950">Thêm vào giỏ</button>
                    ) : (
                      <button onClick={() => setShowQuickView(false)} className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">Đóng</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
