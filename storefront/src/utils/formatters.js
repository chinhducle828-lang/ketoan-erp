// Utility functions for formatting

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'VND';
const DEFAULT_EXCHANGE_RATE = Number(import.meta.env.VITE_DEFAULT_EXCHANGE_RATE || 24000);

// Dynamic currency formatting based on selected currency
// exchangeRate: 1 USD = X VND (used to convert VND to USD)
// If exchangeRate is not provided, it will be fetched from localStorage or use default
export const formatPrice = (value, currency = DEFAULT_CURRENCY, exchangeRate) => {
  const numValue = Number(value) || 0;
  
  // Get exchange rate from localStorage if not provided
  let rate = exchangeRate;
  if (rate === undefined || rate === null) {
    try {
      const cached = localStorage.getItem('exchange_rate_vnd_usd');
      if (cached) {
        const { rate: cachedRate } = JSON.parse(cached);
        rate = cachedRate;
      }
    } catch {
      // ignore errors
    }
    rate = rate || DEFAULT_EXCHANGE_RATE; // Default fallback
  }
  
  if (currency === 'USD' && rate > 0) {
    // Convert VND to USD
    const usdValue = numValue / rate;
    return `$${usdValue.toFixed(2)}`;
  }
  
  // Format as VND
  return `${numValue.toLocaleString('vi-VN')} ₫`;
};

// Convert price from VND to target currency
export const convertPrice = (priceVND, targetCurrency, exchangeRate = DEFAULT_EXCHANGE_RATE) => {
  if (targetCurrency === 'VND') {
    return priceVND;
  }
  if (targetCurrency === 'USD' && exchangeRate > 0) {
    return priceVND / exchangeRate;
  }
  return priceVND;
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
    pending: 'Chờ xử lý',
    selectedProduct: 'Sản phẩm đang chọn',
    unit: 'Đơn vị',
    // Admin role
    adminPanelTitle: 'Quản lý danh mục sản phẩm',
    adminPanelSubtitle: 'Phân hệ thay thế ItemManagement trên ERP',
    createUpdateProduct: 'Tạo/Cập nhật sản phẩm',
    productCode: 'Mã SP',
    unitShort: 'ĐVT',
    productName: 'Tên sản phẩm',
    description: 'Mô tả',
    price: 'Giá bán',
    openingQuantity: 'SL nhập kho',
    addImages: 'Thêm ảnh',
    maxImages: 'Tối đa 6 ảnh, ảnh đầu tiên là ảnh đại diện',
    create: 'Tạo mới',
    save: 'Lưu',
    reset: 'Làm mới',
    saveUpdate: 'Lưu cập nhật',
    orderTracking: 'Theo dõi đơn xuất kho',
    productCatalog: 'Danh mục sản phẩm',
    noOrders: 'Chưa có đơn nào',
    noProducts: 'Chưa có sản phẩm',
    editAction: 'Sửa',
    deleteAction: 'Xóa',
    productsCount: 'sản phẩm',
    pendingOrders: 'đơn chờ',
    adminSessionStatus: 'Phiên admin từ ERP',
    // Sales role
    posCounter: 'Quầy bán hàng POS - Tạo hóa đơn nhanh',
    posMode: 'POS Mode: Nhân viên bán hàng',
    cartItems: 'món',
    currentSubtotal: 'Tạm tính hiện tại',
    ordersTracking: 'Đơn đang theo dõi',
    quickCart: 'Giỏ hàng nhanh',
    emptyCart: 'Giỏ hàng hiện trống',
    productInCart: 'Sản phẩm trong đơn',
    lines: 'dòng',
    quickActions: 'Thao tác nhanh POS',
    shippingEstimate: 'Ước tính phí ship',
    orderTrackingSales: 'Theo dõi xử lý đơn',
    noOrdersInQueue: 'Chưa có đơn trong hàng chờ xuất kho',
    quickSellingSuggestions: 'Gợi ý bán nhanh tại quầy',
    // Warehouse role
    warehouseTracking: 'Theo dõi số lượng cần xuất kho',
    warehouseDescription: 'Danh sách dưới đây là số lượng bán hàng do nhân viên bán hàng nhập, dùng để bốc và xuất đúng số lượng',
    filterByStatus: 'Lọc theo trạng thái',
    noSessionFromERP: 'Chưa có phiên từ ERP. Hãy mở storefront từ tài khoản nhân viên kho trên ERP',
    loadingQueue: 'Đang tải hàng đợi xuất kho...',
    noOrdersWithFilter: 'Không có đơn phù hợp với bộ lọc trạng thái',
    completeWarehouseOrder: 'Hoàn thành đơn xuất kho',
    totalQuantity: 'Tổng SL',
    orderLines: 'Chi tiết đơn hàng',
    noOrderLines: 'Không có dòng sản phẩm chi tiết',
    // Common
    description: 'Mô tả',
    date: 'Ngày',
    status: 'Trạng thái',
    actions: 'Thao tác',
    viewDetails: 'Xem chi tiết',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
    submit: 'Gửi',
    delete: 'Xóa',
    createSuccess: 'Tạo mới thành công',
    updateSuccess: 'Cập nhật thành công',
    deleteSuccess: 'Xóa thành công',
    deleteConfirm: 'Bạn có chắc chắn muốn xóa?',
    error: 'Lỗi',
    success: 'Thành công',
    warning: 'Cảnh báo',
    info: 'Thông tin'
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
    pending: 'Pending',
    selectedProduct: 'Selected Product',
    unit: 'Unit',
    // Admin role
    adminPanelTitle: 'Product Catalog Management',
    adminPanelSubtitle: 'Replaces ItemManagement on ERP for sales admin',
    createUpdateProduct: 'Create/Update Product',
    productCode: 'Code',
    unitShort: 'Unit',
    productName: 'Product Name',
    description: 'Description',
    price: 'Price',
    openingQuantity: 'Opening Qty',
    addImages: 'Add Images',
    maxImages: 'Max 6 images, first image is thumbnail',
    create: 'Create',
    save: 'Save',
    reset: 'Reset',
    saveUpdate: 'Save Update',
    orderTracking: 'Order Tracking',
    productCatalog: 'Product Catalog',
    noOrders: 'No orders yet',
    noProducts: 'No products yet',
    editAction: 'Edit',
    deleteAction: 'Delete',
    productsCount: 'products',
    pendingOrders: 'pending orders',
    adminSessionStatus: 'Admin session from ERP',
    // Sales role
    posCounter: 'POS Counter - Quick Checkout',
    posMode: 'POS Mode: Sales Staff',
    cartItems: 'items',
    currentSubtotal: 'Current Subtotal',
    ordersTracking: 'Orders Tracking',
    quickCart: 'Quick Cart',
    emptyCart: 'Cart is empty',
    productInCart: 'Products in order',
    lines: 'lines',
    quickActions: 'Quick POS Actions',
    shippingEstimate: 'Shipping Estimate',
    orderTrackingSales: 'Order Processing Tracking',
    noOrdersInQueue: 'No orders in warehouse queue',
    quickSellingSuggestions: 'Quick Selling Suggestions',
    // Warehouse role
    warehouseTracking: 'Warehouse Quantity Tracking',
    warehouseDescription: 'Below is the sales quantity entered by sales staff, used for picking and shipping',
    filterByStatus: 'Filter by Status',
    noSessionFromERP: 'No session from ERP. Please open storefront from warehouse staff account on ERP',
    loadingQueue: 'Loading warehouse queue...',
    noOrdersWithFilter: 'No orders match the status filter',
    completeWarehouseOrder: 'Complete Warehouse Order',
    totalQuantity: 'Total Qty',
    orderLines: 'Order Details',
    noOrderLines: 'No product line details',
    // Common
    description: 'Description',
    date: 'Date',
    status: 'Status',
    actions: 'Actions',
    viewDetails: 'View Details',
    confirm: 'Confirm',
    cancel: 'Cancel',
    submit: 'Submit',
    delete: 'Delete',
    createSuccess: 'Created successfully',
    updateSuccess: 'Updated successfully',
    deleteSuccess: 'Deleted successfully',
    deleteConfirm: 'Are you sure you want to delete?',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information'
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

// Get unit price already including VAT (gross price)
// defaultVatRate: thuế suất áp dụng (mặc định 0.1 - 10%)
export const getUnitPriceWithTax = (item, defaultVatRate = 0.1) => {
  const netPrice = getUnitPrice(item);
  const rate = Number(defaultVatRate) || 0;
  return Number((netPrice * (1 + rate)).toFixed(2));
};

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