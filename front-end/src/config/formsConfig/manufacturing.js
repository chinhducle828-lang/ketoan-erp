/**
 * manufacturing.js - UI Schema cho nghiệp vụ Sản Xuất
 * Hỗ trợ 3 stages: Mua NVL → Sản xuất → Bán thành phẩm
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'manufacturing',
  eventName: 'Sản Xuất & Chuyển Kho NVL',
  description: 'Nghiệp vụ sản xuất: Mua NVL → Sản xuất → Thành phẩm',
  
  sections: [
    {
      id: 'production_order',
      title: 'Lệnh sản xuất',
      order: 1
    },
    {
      id: 'materials',
      title: 'Nguyên vật liệu đầu vào',
      order: 2
    },
    {
      id: 'labor',
      title: 'Chi phí nhân công',
      order: 3
    },
    {
      id: 'overhead',
      title: 'Chi phí sản xuất chung',
      order: 4
    },
    {
      id: 'output',
      title: 'Thành phẩm đầu ra',
      order: 5
    }
  ],
  
  fields: [
    // ──────────────────────────────────────────────
    // SECTION 1: Lệnh sản xuất
    // ──────────────────────────────────────────────
    {
      id: 'production_order_id',
      section: 'production_order',
      type: 'TEXT',
      label: 'Mã lệnh sản xuất',
      required: true,
      placeholder: 'VD: PRD-2024-001',
      helpText: 'Mã định danh lệnh sản xuất'
    },
    {
      id: 'product_id',
      section: 'production_order',
      type: 'SELECT',
      label: 'Thành phẩm sản xuất',
      required: true,
      source: '/api/items?type=finished_goods',
      displayField: 'name',
      valueField: 'id',
      searchable: true,
      helpText: 'Sản phẩm thành phẩm cần sản xuất'
    },
    {
      id: 'quantity',
      section: 'production_order',
      type: 'NUMBER',
      label: 'Số lượng sản xuất',
      required: true,
      min: 1,
      step: 1,
      helpText: 'Số lượng thành phẩm cần sản xuất'
    },
    {
      id: 'start_date',
      section: 'production_order',
      type: 'DATE',
      label: 'Ngày bắt đầu',
      required: true,
      defaultValue: 'today',
      helpText: 'Ngày bắt đầu sản xuất'
    },
    {
      id: 'end_date',
      section: 'production_order',
      type: 'DATE',
      label: 'Ngày kết thúc',
      required: false,
      helpText: 'Ngày dự kiến hoàn thành'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 2: Nguyên vật liệu đầu vào
    // ──────────────────────────────────────────────
    {
      id: 'materials',
      section: 'materials',
      type: 'SUB_GRID',
      label: 'Nguyên vật liệu sử dụng',
      required: true,
      minRows: 1,
      maxRows: 20,
      columns: [
        {
          field: 'item_id',
          type: 'SELECT',
          label: 'Nguyên liệu',
          required: true,
          source: '/api/items?type=raw_material',
          displayField: 'name',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'quantity',
          type: 'NUMBER',
          label: 'Số lượng sử dụng',
          required: true,
          min: 0.01,
          step: 0.01,
          helpText: 'Số lượng NVL xuất kho'
        },
        {
          field: 'unit_price',
          type: 'CURRENCY',
          label: 'Đơn giá (VND)',
          required: true,
          min: 0,
          step: 1000,
          helpText: 'Đơn giá NVL theo bình quân'
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
      helpText: 'Danh sách NVL xuất kho cho sản xuất'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 3: Chi phí nhân công
    // ──────────────────────────────────────────────
    {
      id: 'labor_hours',
      section: 'labor',
      type: 'NUMBER',
      label: 'Tổng số giờ công',
      required: true,
      min: 0,
      step: 0.5,
      helpText: 'Tổng số giờ làm việc của công nhân'
    },
    {
      id: 'labor_rate',
      section: 'labor',
      type: 'CURRENCY',
      label: 'Đơn giá nhân công (VND/giờ)',
      required: true,
      min: 0,
      step: 1000,
      defaultValue: 50000,
      helpText: 'Đơn giá nhân công trung bình'
    },
    {
      id: 'labor_cost',
      section: 'labor',
      type: 'CURRENCY',
      label: 'Tổng chi phí nhân công (VND)',
      required: true,
      computed: true,
      computeFormula: 'labor_hours * labor_rate',
      helpText: 'Tự động tính: Giờ công × Đơn giá'
    },
    {
      id: 'employee_ids',
      section: 'labor',
      type: 'MULTI_SELECT',
      label: 'Danh sách công nhân',
      required: false,
      source: '/api/employees?department=production',
      displayField: 'full_name',
      valueField: 'id',
      helpText: 'Chọn công nhân tham gia sản xuất'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 4: Chi phí sản xuất chung
    // ──────────────────────────────────────────────
    {
      id: 'overhead_items',
      section: 'overhead',
      type: 'SUB_GRID',
      label: 'Chi phí sản xuất chung',
      required: false,
      minRows: 0,
      maxRows: 10,
      columns: [
        {
          field: 'description',
          type: 'TEXT',
          label: 'Diễn giải',
          required: true,
          placeholder: 'VD: Điện, nước, khấu hao máy móc'
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Số tiền (VND)',
          required: true,
          min: 0,
          step: 1000
        }
      ],
      helpText: 'Các chi phí sản xuất chung khác'
    },
    {
      id: 'total_overhead',
      section: 'overhead',
      type: 'CURRENCY',
      label: 'Tổng chi phí sản xuất chung (VND)',
      required: false,
      computed: true,
      computeFormula: 'SUM(overhead_items.amount)',
      helpText: 'Tự động tính tổng CP chung'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 5: Thành phẩm đầu ra
    // ──────────────────────────────────────────────
    {
      id: 'output_quantity',
      section: 'output',
      type: 'NUMBER',
      label: 'Số lượng thành phẩm',
      required: true,
      min: 1,
      step: 1,
      helpText: 'Số lượng thành phẩm thu được'
    },
    {
      id: 'unit_cost',
      section: 'output',
      type: 'CURRENCY',
      label: 'Đơn giá thành phẩm (VND)',
      required: true,
      computed: true,
      computeFormula: '(SUM(materials.amount) + labor_cost + total_overhead) / output_quantity',
      helpText: 'Tự động tính: (Tổng NVL + Nhân công + CP chung) / Số lượng'
    },
    {
      id: 'warehouse_id',
      section: 'output',
      type: 'SELECT',
      label: 'Kho nhập thành phẩm',
      required: true,
      source: '/api/warehouses',
      displayField: 'warehouse_name',
      valueField: 'id',
      helpText: 'Kho nhập thành phẩm'
    }
  ],
  
  // ──────────────────────────────────────────────
  // COMPUTED FIELDS
  // ──────────────────────────────────────────────
  computedFields: {
    total_material_cost: 'SUM(materials.amount)',
    total_production_cost: 'total_material_cost + labor_cost + total_overhead',
    unit_cost: 'total_production_cost / output_quantity'
  },
  
  // ──────────────────────────────────────────────
  // VALIDATION RULES
  // ──────────────────────────────────────────────
  validation: {
    production_order_id: {
      required: true,
      pattern: '^PRD-[0-9]{4}-[0-9]+$',
      message: 'Mã lệnh sản xuất phải theo định dạng PRD-YYYY-NNN'
    },
    product_id: {
      required: true,
      message: 'Vui lòng chọn thành phẩm'
    },
    quantity: {
      min: 1,
      message: 'Số lượng sản xuất phải >= 1'
    },
    'materials': {
      minRows: 1,
      message: 'Phải có ít nhất 1 nguyên liệu'
    },
    'materials.quantity': {
      min: 0.01,
      message: 'Số lượng NVL phải > 0'
    },
    output_quantity: {
      min: 1,
      message: 'Số lượng thành phẩm phải >= 1'
    }
  },
  
  // ──────────────────────────────────────────────
  // UI BEHAVIOR
  // ──────────────────────────────────────────────
  behavior: {
    autoCalculateCost: true,
    showMaterialGrid: true,
    showOverheadGrid: true,
    enableKeyboardShortcuts: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn tạo lệnh sản xuất này?',
    // Multi-step wizard
    showAsWizard: true,
    wizardSteps: [
      { section: 'production_order', title: 'Thông tin lệnh' },
      { section: 'materials', title: 'Nguyên vật liệu' },
      { section: 'labor', title: 'Nhân công' },
      { section: 'overhead', title: 'Chi phí chung' },
      { section: 'output', title: 'Thành phẩm' }
    ]
  },
  
  // ──────────────────────────────────────────────
  // BACKEND MAPPING
  // ──────────────────────────────────────────────
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'manufacturing',
    // Backend sẽ tạo 3 bút toán:
    // 1. Nợ TK 154 (WIP) / Có TK 152 (Raw Materials) + TK 334 (Payroll) + TK 627 (Overhead)
    // 2. Nợ TK 155 (Finished Goods) / Có TK 154 (WIP)
    subEvents: [
      {
        stage: 'material_consumption',
        description: 'Xuất NVL vào sản xuất'
      },
      {
        stage: 'labor_allocation',
        description: 'Phân bổ nhân công'
      },
      {
        stage: 'overhead_allocation',
        description: 'Phân bổ chi phí sản xuất chung'
      },
      {
        stage: 'finished_goods',
        description: 'Nhận thành phẩm'
      }
    ]
  }
};