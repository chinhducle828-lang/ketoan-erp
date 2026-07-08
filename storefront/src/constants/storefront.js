/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Storefront Configuration Constants
 * Centralized configuration for easy maintenance and theming
 */

/**
 * Stock Management Thresholds
 */
export const STOCK_THRESHOLDS = {
  LOW_STOCK_DEFAULT: 10, // Default threshold for low stock warning
  OUT_OF_STOCK: 0, // Out of stock threshold
};

/**
 * Toast Notification Defaults
 */
export const TOAST_DEFAULTS = {
  DURATION: 5000, // Auto-dismiss after 5 seconds
  POSITION: 'top-right',
};

/**
 * Touch Target Sizes (WCAG 2.1 AA Compliant)
 */
export const TOUCH_TARGET = {
  MIN_SIZE: 44, // Minimum 44x44px for mobile touch targets
};

/**
 * Cart Configuration
 */
export const CART_CONFIG = {
  MAX_QUANTITY: 999,
  MIN_QUANTITY: 1,
};

/**
 * UI Text Constants (Bilingual)
 */
export const UI_TEXT = {
  VI: {
    STOCK_HIGH: 'Còn',
    STOCK_LOW: 'Chỉ còn',
    STOCK_OUT: 'Hết hàng',
    UNIT_DEFAULT: 'đơn vị',
    ADD_TO_CART: 'Thêm vào giỏ',
    CHECKOUT: 'Tiến hành đặt hàng',
    WISHLIST_ADD: 'Thêm vào yêu thích',
    WISHLIST_REMOVE: 'Xóa khỏi yêu thích',
  },
  EN: {
    STOCK_HIGH: 'In stock',
    STOCK_LOW: 'Only',
    STOCK_OUT: 'Out of stock',
    UNIT_DEFAULT: 'units',
    ADD_TO_CART: 'Add to cart',
    CHECKOUT: 'Proceed to checkout',
    WISHLIST_ADD: 'Add to wishlist',
    WISHLIST_REMOVE: 'Remove from wishlist',
  },
};

/**
 * Animation Durations (in ms)
 */
export const ANIMATION = {
  TOAST_ENTER: 300,
  TOAST_EXIT: 300,
  TRANSITION: 200,
};

/**
 * Breakpoints (for reference)
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
};