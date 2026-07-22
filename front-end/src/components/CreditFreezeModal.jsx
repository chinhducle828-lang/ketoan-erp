import { useState, useEffect } from 'react';

/**
 * Credit Freeze Modal
 * Hiển thị khi đơn hàng bị freeze do vượt hạn mức tín dụng
 * Màu vàng cảnh báo, hiển thị thông tin chi tiết
 */
export default function CreditFreezeModal({ isOpen, onClose, orderData, onRetry, onContactSupport }) {
  const [countdown, setCountdown] = useState(300); // 5 phút

  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !orderData) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const availableCredit = orderData.creditInfo?.available_credit || 0;
  const orderTotal = orderData.total || 0;
  const shortfall = orderTotal - availableCredit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header - Màu vàng cảnh báo */}
        <div className="bg-yellow-500 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold">Đơn hàng bị tạm khóa</h2>
              <p className="text-yellow-100 text-sm">Hạn mức tín dụng không đủ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-yellow-100 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Thông tin đơn hàng */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Thông tin đơn hàng</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Mã đơn hàng:</span>
                <p className="font-mono font-medium">{orderData.orderCode || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-600">Tổng giá trị:</span>
                <p className="font-bold text-red-600">{orderTotal.toLocaleString('vi-VN')}đ</p>
              </div>
              <div>
                <span className="text-gray-600">Khách hàng:</span>
                <p className="font-medium">{orderData.customerName || 'Khách lẻ'}</p>
              </div>
              <div>
                <span className="text-gray-600">Trạng thái:</span>
                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                  FROZEN
                </span>
              </div>
            </div>
          </div>

          {/* Thông tin tín dụng */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              Thông tin tín dụng
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Hạn mức tín dụng:</span>
                <span className="font-medium">{(orderData.creditInfo?.credit_limit || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Đã sử dụng:</span>
                <span className="font-medium text-red-600">
                  {(orderData.creditInfo?.used_credit || 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between border-t border-red-200 pt-2">
                <span className="text-gray-700">Còn lại:</span>
                <span className="font-bold text-red-700">{availableCredit.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between bg-red-100 p-2 rounded">
                <span className="font-semibold text-red-900">Thiếu hụt:</span>
                <span className="font-bold text-red-900">{shortfall.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Đã sử dụng</span>
                <span>{Math.round((orderData.creditInfo?.used_credit / orderData.creditInfo?.credit_limit) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min((orderData.creditInfo?.used_credit / orderData.creditInfo?.credit_limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cảnh báo */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Lý do khóa</h3>
            <p className="text-sm text-yellow-800">
              Tổng giá trị đơn hàng (<strong>{orderTotal.toLocaleString('vi-VN')}đ</strong>) vượt quá hạn mức tín dụng còn lại 
              (<strong>{availableCredit.toLocaleString('vi-VN')}đ</strong>). Vui lòng liên hệ bộ phận kế toán để được 
              điều chỉnh hạn mức hoặc thanh toán một phần công nợ trước khi đặt hàng.
            </p>
          </div>

          {/* Countdown */}
          <div className="text-center text-sm text-gray-600">
            Đơn hàng sẽ tự động hủy sau <span className="font-bold text-red-600">{formatTime(countdown)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onContactSupport}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Liên hệ kế toán
          </button>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Thử lại (sau khi điều chỉnh)
          </button>
        </div>
      </div>
    </div>
  );
}