import { useState, useEffect } from 'react';

/**
 * Tax Warning Modal
 * Cảnh báo khi phát hiện thuế chưa được khấu trừ đầy đủ
 * Màu đỏ cảnh báo, hiển thị chi tiết thuế
 */
export default function TaxWarningModal({ isOpen, onClose, taxData, onConfirm, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowDetails(false);
    }
  }, [isOpen]);

  if (!isOpen || !taxData) return null;

  const totalTax = taxData.taxDetails?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const deductibleTax = taxData.deductibleTax || 0;
  const nonDeductibleTax = totalTax - deductibleTax;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header - Màu đỏ cảnh báo */}
        <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-xl font-bold">Cảnh báo thuế</h2>
              <p className="text-red-100 text-sm">Thuế chưa được khấu trừ đầy đủ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-100 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Tổng quan thuế */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-3">Tổng quan thuế</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Tổng thuế GTGT:</span>
                <span className="font-medium">{totalTax.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Thuế được khấu trừ:</span>
                <span className="font-medium text-green-600">{deductibleTax.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between border-t border-red-200 pt-2">
                <span className="text-gray-700">Thuế không được khấu trừ:</span>
                <span className="font-bold text-red-700">{nonDeductibleTax.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          </div>

          {/* Chi tiết từng loại thuế */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            >
              {showDetails ? 'Ẩn' : 'Hiện'} chi tiết
              <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-2">
                {taxData.taxDetails?.map((tax, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{tax.type}</span>
                      <span className="text-gray-600 ml-2">({tax.rate}%)</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{tax.amount.toLocaleString('vi-VN')}đ</div>
                      {tax.deductible ? (
                        <span className="text-xs text-green-600">Được khấu trừ</span>
                      ) : (
                        <span className="text-xs text-red-600">Không được khấu trừ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cảnh báo */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Lưu ý</h3>
            <p className="text-sm text-yellow-800">
              Thuế GTGT đầu vào chỉ được khấu trừ khi có hóa đơn hợp lệ và phù hợp với quy định pháp luật. 
              Vui lòng kiểm tra lại chứng từ thuế và báo cáo với bộ phận kế toán nếu cần.
            </p>
          </div>

          {/* Thông tin bổ sung */}
          {taxData.documentCode && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-600">Mã chứng từ:</span>
                  <p className="font-mono font-medium">{taxData.documentCode}</p>
                </div>
                <div>
                  <span className="text-gray-600">Ngày chứng từ:</span>
                  <p className="font-medium">{taxData.documentDate}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onDismiss}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Bỏ qua
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Xác nhận và tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}