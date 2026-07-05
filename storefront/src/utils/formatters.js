// Utility functions for formatting

// Dynamic currency formatting based on selected currency
export const formatPrice = (value, currency = 'VND') => {
  const numValue = Number(value) || 0;
  if (currency === 'USD') {
    return `$${numValue.toFixed(2)}`;
  }
  return `${numValue.toLocaleString('vi-VN')} ₫`;
};

// Translation function for multi-language support
export const translations = {
  VI: {
    customerName: 'Tên khách',
    phone: 'Số điện thoại',
    address: 'Địa chỉ',
    quantity: 'Số lượng',
    amount: 'Giá trị',
    coupon: 'Mã giảm giá',
    apply: 'Áp dụng',
    checkout: 'Tạo hóa đơn',
    addToCart: 'Thêm vào giỏ',
    addToOrder: 'Thêm vào đơn',
    buyNow: 'Đặt mua',
    details: 'Chi tiết',
    edit: 'Sửa sản phẩm',
    trackStock: 'Theo dõi hàng tồn',
    search: 'Tìm kiếm sản phẩm...',
    sort: 'Sắp xếp',
    maxPrice: 'Giá tối đa',
    all: 'Tất cả',
    categories: 'Danh mục',
    subtotal: 'Tạm tính',
    discount: 'Giảm giá',
    total: 'Tổng tạm tính',
    freeShipping: 'Miễn phí vận chuyển',
    enterPostalCode: 'Nhập mã bưu chính',
    guest: 'Khách vãng lai',
    admin: 'Admin bán hàng',
    sales: 'Nhân viên bán hàng',
    warehouse: 'Nhân viên kho',
    posMode: 'POS Mode',
    loading: 'Đang tải...',
    noProducts: 'Không có sản phẩm phù hợp',
    selectProduct: 'Chọn một sản phẩm để xem thông tin chi tiết',
    orderSuccess: 'Đặt hàng thành công',
    orderNumber: 'Mã chứng từ',
    processing: 'Đang xử lý',
    completed: 'Đã hoàn thành',
    pending: 'Chờ xử lý'
  },
  EN: {
    customerName: 'Customer Name',
    phone: 'Phone Number',
    address: 'Address',
    quantity: 'Quantity',
    amount: 'Amount',
    coupon: 'Coupon Code',
    apply: 'Apply',
    checkout: 'Checkout',
    addToCart: 'Add to Cart',
    addToOrder: 'Add to Order',
    buyNow: 'Buy Now',
    details: 'Details',
    edit: 'Edit Product',
    trackStock: 'Track Stock',
    search: 'Search products...',
    sort: 'Sort',
    maxPrice: 'Max Price',
    all: 'All',
    categories: 'Categories',
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total',
    freeShipping: 'Free Shipping',
    enterPostalCode: 'Enter postal code',
    guest: 'Guest',
    admin: 'Sales Admin',
    sales: 'Sales Staff',
    warehouse: 'Warehouse Staff',
    posMode: 'POS Mode',
    loading: 'Loading...',
    noProducts: 'No products found',
    selectProduct: 'Select a product to view details',
    orderSuccess: 'Order placed successfully',
    orderNumber: 'Order Number',
    processing: 'Processing',
    completed: 'Completed',
    pending: 'Pending'
  }
};

export const t = (key, lang = 'VI') => {
  return translations[lang]?.[key] || translations['VI']?.[key] || key;
};

// Format display date
export const formatDisplayDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('vi-VN');
};

// Parse price value
export const parsePriceValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  let raw = String(value).trim();
  if (!raw) return 0;
  raw = raw.replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
  if (!raw) return 0;

  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
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

// Get unit price
export const getUnitPrice = (item) => parsePriceValue(item?.price_sell);

// Get order amount
export const getOrderAmount = (item, quantity) => 
  Number((getUnitPrice(item) * Math.max(Number(quantity) || 1, 1)).toFixed(2));

// Normalize URL
export const normalizeAbsoluteUrl = (value) => {
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

// Resolve media URL
export const resolveMediaUrl = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  const normalizedPath = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${import.meta.env.VITE_API_BASE_URL || 'https://dazzling-grace-production-03a5.up.railway.app'}/${normalizedPath}`;
};

// Build ERP login URL
export const buildErpLoginUrl = (baseUrl, companyId, role) => {
  const url = new URL(baseUrl);
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/login';
  }
  if (companyId) url.searchParams.set('company_id', companyId);
  if (role) url.searchParams.set('role', role);
  return url.toString();
};

// Build bearer config
export const buildBearerConfig = (token) => {
  if (!token) return {};
  return { headers: { Authorization: `Bearer ${token}` } };
};

// Check session allowed for role
export const isSessionAllowedForRole = (targetRole, sessionRole) => {
  if (!targetRole || targetRole === 'guest') return true;
  if (!sessionRole) return false;
  if (targetRole === 'admin') return sessionRole === 'admin';
  if (targetRole === 'nv_kho') return sessionRole === 'nv_kho' || sessionRole === 'admin';
  if (targetRole === 'nv_banhang') return sessionRole === 'nv_banhang' || sessionRole === 'admin';
  return false;
};

// Get role display name
export const getRoleDisplayName = (role) => {
  if (role === 'admin') return 'admin';
  if (role === 'nv_kho') return 'nhân viên kho';
  if (role === 'nv_banhang') return 'nhân viên bán hàng';
  return 'người dùng';
};

// Check explicit non-admin role
export const isExplicitNonAdminRole = (roleCode) => {
  const normalized = String(roleCode || '').trim().toLowerCase();
  return normalized !== '' && normalized !== 'admin';
};