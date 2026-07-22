/**
 * sale.js - UI Schema cho nghiệp vụ Bán Hàng
 * Hỗ trợ cả trading (TK 1561) và manufacturing (TK 155)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'sale',
  eventName: 'Bán Hàng & Xuất Hóa Đơn',
  description: 'Nghiệp vụ bán hàng hóa, dịch vụ cho khách hàng',
  
  sections: [
    {
      id: 'customer',
      title: 'Thông tin khách hàng',
      order: 1
    },
    {
      id: 'items',
      title: 'Sản phẩm/Dịch vụ',
      order: 2
    },
    {
      id: 'tax',
      title: 'Thuế & Chiết khấu',
      order: 3
    },
    {
      id: 'payment',
      title: 'Thanh toán',
      order: 4
    }
  ],
  
  fields: [
    // ──────────────────────────────────────────────
    // SECTION 1: Thông tin khách hàng
    // ──────────────────────────────────────────────
    {
      id: 'partner_id',
      section: 'customer',
      type: 'SELECT',
      label: 'Khách hàng',
      placeholder: 'Chọn khách hàng...',
      required: true,
      source: '/api/partners?type=customer',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true,
      helpText: 'Chọn khách hàng từ danh mục đối tác'
    },
    {
      id: 'sales_channel',
      section: 'customer',
      type: 'SELECT',
      label: 'Kênh bán',
      required: true,
      defaultValue: 'direct',
      options: [
        { value: 'direct', label: 'Bán trực tiếp' },
        { value: 'storefront', label: 'Storefront (Online)' },
        { value: 'agent', label: 'Đại lý' },
        { value: 'distributor', label: 'Nhà phân phối' }
      ],
      helpText: 'Kênh bán hàng'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 2: Sản phẩm/Dịch vụ
    // ──────────────────────────────────────────────
    {
      id: 'items',
      section: 'items',
      type: 'SUB_GRID',
      label: 'Chi tiết hàng bán',
      required: true,
      minRows: 1,
      maxRows: 50,
      columns: [
        {
          field: 'item_id',
          type: 'SELECT',
          label: 'Sản phẩm/Dịch vụ',
          required: true,
          source: '/api/items',
          displayField: 'name',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'quantity',
          type: 'NUMBER',
          label: 'Số lượng',
          required: true,
          min: 1,
          step: 1,
          defaultValue: 1
        },
        {
          field: 'unit_price',
          type: 'CURRENCY',
          label: 'Đơn giá (VND)',
          required: true,
          min: 0,
          step: 1000
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Thành tiền',
          required: true,
          computed: true,
          computeFormula: 'quantity * unit_price'
        }
      ],
      helpText: 'Danh sách sản phẩm/dịch vụ bán'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 3: Thuế & Chiết khấu
    // ──────────────────────────────────────────────
    {
      id: 'discount_amount',
      section: 'tax',
      type: 'CURRENCY',
      label: 'Chiết khấu (VND)',
      required: false,
      min: 0,
      defaultValue: 0,
      step: 1000,
      helpText: 'Chiết khấu thương mại (nếu có)'
    },
    {
      id: 'discount_reason',
      section: 'tax',
      type: 'SELECT',
      label: 'Lý do chiết khấu',
      required: false,
      options: [
        { value: '', label: 'Không có' },
        { value: 'volume', label: 'Chiết khấu số lượng' },
        { value: 'promotion', label: 'Khuyến mãi' },
        { value: 'special', label: 'Chiết khấu đặc biệt' }
      ],
      helpText: 'Lý do áp dụng chiết khấu'
    },
    {
      id: 'tax_rate',
      section: 'tax',
      type: 'SELECT',
      label: 'Thuế suất GTGT',
      required: true,
      defaultValue: 8,
      options: [
        { value: 0, label: '0% (Không chịu thuế)' },
        { value: 5, label: '5%' },
        { value: 8, label: '8%' },
        { value: 10, label: '10%' }
      ],
      helpText: 'Thuế suất GTGT áp dụng'
    },
    {
      id: 'tax_amount',
      section: 'tax',
      type: 'CURRENCY',
      label: 'Tiền thuế GTGT (VND)',
      required: false,
      min: 0,
      computed: true,
      computeFormula: '(total_amount - discount_amount) * tax_rate / 100',
      helpText: 'Tự động tính: (Tổng tiền - Chiết khấu) × Thuế suất'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 4: Thanh toán
    // ──────────────────────────────────────────────
    {
      id: 'payment_method',
      section: 'payment',
      type: 'SELECT',
      label: 'Phương thức thanh toán',
      required: true,
      defaultValue: 'cash',
      options: [
        { value: 'cash', label: 'Tiền mặt' },
        { value: 'bank_transfer', label: 'Chuyển khoản' },
        { value: 'casso', label: 'Casso (Auto-reconcile)' },
        { value: 'credit', label: 'Bán chịu (Công nợ)' }
      ],
      helpText: 'Phương thức thanh toán'
    },
    {
      id: 'payment_status',
      section: 'payment',
      type: 'SELECT',
      label: 'Trạng thái thanh toán',
      required: true,
      defaultValue: 'pending',
      options: [
        { value: 'pending', label: 'Chưa thanh toán' },
        { value: 'partial', label: 'Thanh toán một phần' },
        { value: 'paid', label: 'Đã thanh toán' }
      ],
      helpText: 'Trạng thái thanh toán'
    },
    {
      id: 'amount_paid',
      section: 'payment',
      type: 'CURRENCY',
      label: 'Số tiền đã nhận (VND)',
      required: false,
      min: 0,
      defaultValue: 0,
      step: 1000,
      helpText: 'Số tiền khách hàng đã trả'
    },
    {
      id: 'shipping_fee',
      section: 'payment',
      type: 'CURRENCY',
      label: 'Phí vận chuyển (VND)',
      required: false,
      min: 0,
      defaultValue: 0,
      step: 1000,
      helpText: 'Phí vận chuyển (nếu có)'
    }
  ],
  
  // ──────────────────────────────────────────────
  // COMPUTED FIELDS (Backend sẽ tính)
  // ──────────────────────────────────────────────
  computedFields: {
    total_amount: 'SUM(items.amount)',
    grand_total: 'total_amount - discount_amount + tax_amount + shipping_fee',
    amount_due: 'grand_total - amount_paid'
  },
  
  // ──────────────────────────────────────────────
  // VALIDATION RULES
  // ──────────────────────────────────────────────
  validation: {
    partner_id: {
      required: true,
      message: 'Vui lòng chọn khách hàng'
    },
    'items': {
      minRows: 1,
      message: 'Phải có ít nhất 1 sản phẩm'
    },
    'items.quantity': {
      min: 1,
      message: 'Số lượng phải >= 1'
    },
    discount_amount: {
      max: 'total_amount',
      message: 'Chiết khấu không được vượt tổng tiền hàng'
    },
    amount_paid: {
      max: 'grand_total',
      message: 'Số tiền nhận không được vượt tổng cộng'
    }
  },
  
  // ──────────────────────────────────────────────
  // UI BEHAVIOR
  // ──────────────────────────────────────────────
  behavior: {
    autoCalculateTotal: true,
    autoCalculateTax: true,
    showItemGrid: true,
    enableKeyboardShortcuts: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn tạo hóa đơn bán hàng này?',
    // Credit Freeze check
    checkCreditLimit: true,
    creditCheckMessage: 'Khách hàng đã vượt hạn mức công nợ. Đơn hàng sẽ được đưa vào trạng thái chờ duyệt.'
  },
  
  // ──────────────────────────────────────────────
  // BACKEND MAPPING
  // ──────────────────────────────────────────────
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'sale',
    // Backend sẽ dùng EVENT_ACCOUNT_REGISTRY.sale
    // và tự động determine TK 632/155 (manufacturing) hoặc 632/156 (trading)
  }
};