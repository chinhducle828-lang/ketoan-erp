import { useState, useEffect } from 'react';

/**
 * Storefront Credit Modal
 * Phiên bản đơn giản cho storefront - cảnh báo khi đơn hàng bị freeze
 * Màu vàng cảnh báo, không có countdown (storefront không cần)
 */
export default function StorefrontCreditModal({ isOpen, onClose, orderData, onRetry }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hide để animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible || !orderData) return null;

  const availableCredit = orderData.available_credit || 0;
  const orderTotal = orderData.total || 0;
  const shortfall = orderTotal - availableCredit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header - Màu vàng cảnh báo */}
        <div className="bg-yellow-500 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="text-lg font-bold">Đơn hàng bị tạm khóa</h2>
              <p className="text-yellow-100 text-xs">Hạn mức tín dụng không đủ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-yellow-100 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Thông tin đơn hàng */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Thông tin đơn hàng</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tổng giá trị:</span>
                <span className="font-bold text-red-600">{orderTotal.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hạn mức còn lại:</span>
                <span className="font-medium">{availableCredit.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-600">Thiếu hụt:</span>
                <span className="font-bold text-red-700">{shortfall.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>

          {/* Cảnh báo */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              Tổng giá trị đơn hàng vượt quá hạn mức tín dụng còn lại. Vui lòng liên hệ bộ phận kế toán 
              hoặc giảm số lượng sản phẩm trong đơn hàng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            Đóng
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    </div>
  );
}