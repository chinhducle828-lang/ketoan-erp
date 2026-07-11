/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Inventory Table Column Configuration
 */

export const INVENTORY_TABLE_COLUMNS = {
  code: { label: 'Mã VT', className: 'font-mono font-bold text-slate-700', width: 'w-[80px]' },
  name: { label: 'Tên vật tư', className: 'text-slate-600 max-w-[200px] truncate', width: 'min-w-[150px]' },
  unit: { label: 'ĐVT', className: '', width: 'w-[60px]' },
  openingQuantity: { label: 'Tồn ĐK', className: 'text-right font-mono', width: 'w-[80px]' },
  inbound: { label: 'Nhập', className: 'text-right font-mono text-green-600', width: 'w-[80px]', prefix: '+' },
  outbound: { label: 'Xuất', className: 'text-right font-mono text-red-600', width: 'w-[80px]', prefix: '-' },
  currentStock: { label: 'Tồn TK', className: 'text-right font-mono font-bold text-indigo-600', width: 'w-[80px]' },
  unitPrice: { label: 'Đơn giá', className: 'text-right font-mono text-slate-500', width: 'w-[100px]' },
  stockValue: { label: 'Giá trị', className: 'text-right font-mono font-bold text-emerald-600', width: 'w-[120px]' }
};

export const INVENTORY_STATS = {
  totalItems: { label: 'Tổng số mặt hàng', icon: 'Package', color: 'text-slate-800' },
  totalQuantity: { label: 'Tổng tồn kho (SL)', icon: 'TrendingUp', color: 'text-slate-800' },
  totalValue: { label: 'Tổng giá trị tồn kho', icon: 'FileSpreadsheet', color: 'text-indigo-600' }
};

export const INVENTORY_MESSAGES = {
  noData: 'Không có dữ liệu tồn kho',
  noDataHint: 'Hãy tạo sản phẩm và nhập kho để bắt đầu',
  loading: 'Đang tải dữ liệu tồn kho...',
  error: 'Không thể tải dữ liệu tồn kho. Vui lòng thử lại.',
  retry: 'Thử lại'
};