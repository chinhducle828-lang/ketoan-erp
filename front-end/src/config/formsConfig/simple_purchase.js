/**
 * simple_purchase.js - UI Schema cho nghiệp vụ Mua Hàng
 * Hỗ trợ cả merchandise (TK 1561) và raw_material (TK 152)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'simple_purchase',
  eventName: 'Mua Hàng & Vật Tư Nhập Kho',
  description: 'Nghiệp vụ mua hàng hóa, nguyên vật liệu từ nhà cung cấp',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'invoice',
      title: 'Chi tiết hóa đơn',
      order: 2
    },
    {
      id: 'notes',
      title: 'Ghi chú',
      order: 3
    }
  ],
  
  fields: [
    // ──────────────────────────────────────────────
    // SECTION 1: Thông tin chung
    // ──────────────────────────────────────────────
    {
      id: 'partner_id',
      section: 'general',
      type: 'SELECT',
      label: 'Nhà cung cấp',
      placeholder: 'Chọn nhà cung cấp...',
      required: true,
      source: '/api/partners?type=supplier',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true,
      helpText: 'Chọn nhà cung cấp từ danh mục đối tác'
    },
    {
      id: 'inventory_type',
      section: 'general',
      type: 'RADIO',
      label: 'Loại hàng nhập',
      required: true,
      defaultValue: 'merchandise',
      options: [
        { 
          value: 'merchandise', 
          label: 'Hàng hóa (TK 1561)',
          description: 'Hàng mua để bán lại (thương mại)'
        },
        { 
          value: 'raw_material', 
          label: 'Nguyên vật liệu (TK 152)',
          description: 'Nguyên liệu sản xuất (sản xuất)'
        }
      ],
      helpText: 'Chọn loại hàng để hệ thống mapping tài khoản chính xác'
    },
    {
      id: 'invoice_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày hóa đơn',
      required: true,
      defaultValue: 'today',
      helpText: 'Ngày phát hành hóa đơn từ NCC'
    },
    {
      id: 'due_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày đến hạn thanh toán',
      required: false,
      helpText: 'Ngày phải thanh toán cho NCC'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 2: Chi tiết hóa đơn
    // ──────────────────────────────────────────────
    {
      id: 'total_amount',
      section: 'invoice',
      type: 'CURRENCY',
      label: 'Tổng tiền hàng (VND)',
      required: true,
      min: 0,
      step: 1000,
      placeholder: '0',
      helpText: 'Tổng giá trị hàng hóa trước thuế'
    },
    {
      id: 'tax_rate',
      section: 'invoice',
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
      helpText: 'Thuế suất GTGT áp dụng cho hóa đơn'
    },
    {
      id: 'tax_amount',
      section: 'invoice',
      type: 'CURRENCY',
      label: 'Tiền thuế GTGT (VND)',
      required: false,
      min: 0,
      computed: true,
      computeFormula: 'total_amount * tax_rate / 100',
      helpText: 'Tự động tính: Tổng tiền × Thuế suất'
    },
    {
      id: 'grand_total',
      section: 'invoice',
      type: 'CURRENCY',
      label: 'Tổng cộng (VND)',
      required: true,
      min: 0,
      computed: true,
      computeFormula: 'total_amount + tax_amount',
      helpText: 'Tổng tiền hàng + Thuế'
    },
    {
      id: 'items',
      section: 'invoice',
      type: 'SUB_GRID',
      label: 'Chi tiết hàng hóa',
      required: true,
      minRows: 1,
      maxRows: 50,
      columns: [
        {
          field: 'item_id',
          type: 'SELECT',
          label: 'Sản phẩm',
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
          step: 1
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
      helpText: 'Danh sách sản phẩm nhập'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 3: Ghi chú
    // ──────────────────────────────────────────────
    {
      id: 'description',
      section: 'notes',
      type: 'TEXTAREA',
      label: 'Diễn giải',
      required: false,
      rows: 3,
      placeholder: 'Nhập diễn giải cho nghiệp vụ...',
      helpText: 'Ghi chú thêm về nghiệp vụ'
    },
    {
      id: 'reference_number',
      section: 'notes',
      type: 'TEXT',
      label: 'Số tham chiếu',
      required: false,
      placeholder: 'VD: PO-2024-001',
      helpText: 'Số đơn đặt hàng (nếu có)'
    }
  ],
  
  // ──────────────────────────────────────────────
  // VALIDATION RULES
  // ──────────────────────────────────────────────
  validation: {
    total_amount: {
      min: 1000,
      message: 'Tổng tiền hàng phải >= 1,000 VND'
    },
    tax_rate: {
      allowedValues: [0, 5, 8, 10],
      message: 'Thuế suất chỉ được chọn: 0%, 5%, 8%, hoặc 10%'
    },
    'items.quantity': {
      min: 1,
      message: 'Số lượng phải >= 1'
    }
  },
  
  // ──────────────────────────────────────────────
  // UI BEHAVIOR
  // ──────────────────────────────────────────────
  behavior: {
    autoCalculateTax: true,
    autoCalculateTotal: true,
    showItemGrid: true,
    enableKeyboardShortcuts: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn lưu nghiệp vụ mua hàng này?'
  },
  
  // ──────────────────────────────────────────────
  // BACKEND MAPPING
  // ──────────────────────────────────────────────
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'simple_purchase',
    // Backend sẽ dùng EVENT_ACCOUNT_REGISTRY.simple_purchase
    // với inventory_type để determine accounts
  }
};