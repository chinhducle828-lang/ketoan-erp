/**
 * early_payment.js - UI Schema cho nghiệp vụ Thanh Toán Sớm
 * Hỗ trợ chiết khấu thanh toán sớm (Early Payment Discount)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'early_payment',
  eventName: 'Thanh Toán Sớm & Chiết Khấu',
  description: 'Nghiệp vụ thanh toán sớm hóa đơn để nhận chiết khấu',
  
  sections: [
    {
      id: 'invoice',
      title: 'Thông tin hóa đơn',
      order: 1
    },
    {
      id: 'payment',
      title: 'Thông tin thanh toán',
      order: 2
    },
    {
      id: 'discount',
      title: 'Chiết khấu thanh toán sớm',
      order: 3
    }
  ],
  
  fields: [
    // ──────────────────────────────────────────────
    // SECTION 1: Thông tin hóa đơn
    // ──────────────────────────────────────────────
    {
      id: 'partner_id',
      section: 'invoice',
      type: 'SELECT',
      label: 'Đối tác (NCC/KH)',
      placeholder: 'Chọn đối tác...',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true,
      helpText: 'Chọn nhà cung cấp hoặc khách hàng'
    },
    {
      id: 'invoice_type',
      section: 'invoice',
      type: 'SELECT',
      label: 'Loại hóa đơn',
      required: true,
      defaultValue: 'purchase',
      options: [
        { value: 'purchase', label: 'Hóa đơn mua hàng (Phải trả NCC)' },
        { value: 'sale', label: 'Hóa đơn bán hàng (Phải thu KH)' }
      ],
      helpText: 'Loại hóa đơn cần thanh toán sớm'
    },
    {
      id: 'invoice_ids',
      section: 'invoice',
      type: 'MULTI_SELECT',
      label: 'Danh sách hóa đơn',
      required: true,
      source: '/api/invoices/pending',
      displayField: 'invoice_number',
      valueField: 'id',
      searchable: true,
      helpText: 'Chọn các hóa đơn cần thanh toán sớm'
    },
    {
      id: 'original_amount',
      section: 'invoice',
      type: 'CURRENCY',
      label: 'Tổng giá trị hóa đơn (VND)',
      required: true,
      min: 0,
      step: 1000,
      helpText: 'Tổng giá trị các hóa đơn trước chiết khấu'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 2: Thông tin thanh toán
    // ──────────────────────────────────────────────
    {
      id: 'payment_date',
      section: 'payment',
      type: 'DATE',
      label: 'Ngày thanh toán',
      required: true,
      defaultValue: 'today',
      helpText: 'Ngày thực hiện thanh toán'
    },
    {
      id: 'payment_method',
      section: 'payment',
      type: 'SELECT',
      label: 'Phương thức thanh toán',
      required: true,
      defaultValue: 'bank_transfer',
      options: [
        { value: 'cash', label: 'Tiền mặt' },
        { value: 'bank_transfer', label: 'Chuyển khoản' },
        { value: 'casso', label: 'Casso' }
      ],
      helpText: 'Phương thức thanh toán'
    },
    {
      id: 'bank_account_id',
      section: 'payment',
      type: 'SELECT',
      label: 'Tài khoản ngân hàng',
      required: true,
      source: '/api/bank-accounts',
      displayField: 'account_number',
      valueField: 'id',
      helpText: 'Tài khoản thực hiện thanh toán'
    },
    {
      id: 'reference_number',
      section: 'payment',
      type: 'TEXT',
      label: 'Số chứng từ thanh toán',
      required: false,
      placeholder: 'VD: PAY-2024-001',
      helpText: 'Số chứng từ ngân hàng (nếu có)'
    },
    
    // ──────────────────────────────────────────────
    // SECTION 3: Chiết khấu thanh toán sớm
    // ──────────────────────────────────────────────
    {
      id: 'discount_percent',
      section: 'discount',
      type: 'NUMBER',
      label: 'Tỷ lệ chiết khấu (%)',
      required: true,
      min: 0,
      max: 100,
      step: 0.1,
      defaultValue: 2,
      helpText: 'Tỷ lệ chiết khấu thanh toán sớm (thường là 2%)'
    },
    {
      id: 'discount_days',
      section: 'discount',
      type: 'NUMBER',
      label: 'Số ngày được chiết khấu',
      required: true,
      min: 1,
      defaultValue: 10,
      helpText: 'Số ngày thanh toán sớm để được hưởng chiết khấu'
    },
    {
      id: 'discount_amount',
      section: 'discount',
      type: 'CURRENCY',
      label: 'Tiền chiết khấu (VND)',
      required: true,
      min: 0,
      computed: true,
      computeFormula: 'original_amount * discount_percent / 100',
      helpText: 'Tự động tính: Tổng tiền × Tỷ lệ chiết khấu'
    },
    {
      id: 'payment_amount',
      section: 'discount',
      type: 'CURRENCY',
      label: 'Số tiền thực thanh toán (VND)',
      required: true,
      min: 0,
      computed: true,
      computeFormula: 'original_amount - discount_amount',
      helpText: 'Tự động tính: Tổng tiền - Chiết khấu'
    },
    {
      id: 'savings_amount',
      section: 'discount',
      type: 'CURRENCY',
      label: 'Tiết kiệm được (VND)',
      required: false,
      computed: true,
      computeFormula: 'discount_amount',
      helpText: 'Số tiền tiết kiệm nhờ thanh toán sớm'
    }
  ],
  
  // ──────────────────────────────────────────────
  // COMPUTED FIELDS
  // ──────────────────────────────────────────────
  computedFields: {
    discount_amount: 'original_amount * discount_percent / 100',
    payment_amount: 'original_amount - discount_amount',
    savings_amount: 'discount_amount'
  },
  
  // ──────────────────────────────────────────────
  // VALIDATION RULES
  // ──────────────────────────────────────────────
  validation: {
    partner_id: {
      required: true,
      message: 'Vui lòng chọn đối tác'
    },
    invoice_ids: {
      minRows: 1,
      message: 'Phải chọn ít nhất 1 hóa đơn'
    },
    original_amount: {
      min: 1000,
      message: 'Tổng giá trị hóa đơn phải >= 1,000 VND'
    },
    discount_percent: {
      min: 0,
      max: 100,
      message: 'Tỷ lệ chiết khấu phải từ 0% đến 100%'
    },
    payment_amount: {
      min: 0,
      message: 'Số tiền thanh toán phải >= 0'
    }
  },
  
  // ──────────────────────────────────────────────
  // UI BEHAVIOR
  // ──────────────────────────────────────────────
  behavior: {
    autoCalculateDiscount: true,
    autoCalculatePayment: true,
    showSavingsHighlight: true,
    enableKeyboardShortcuts: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn thực hiện thanh toán sớm này?',
    // Real-time calculation
    liveCalculation: true,
    highlightSavings: true
  },
  
  // ──────────────────────────────────────────────
  // BACKEND MAPPING
  // ──────────────────────────────────────────────
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'early_payment',
    // Backend sẽ tạo bút toán:
    // Nợ TK 331 (AP) / Có TK 1121 (BANK) + TK 635 (Chiết khấu)
    accounting: {
      debit: ['AP'],  // Giảm công nợ
      credit: ['BANK', 'DISCOUNT_EARLY_PAYMENT']  // Trả tiền + Chiết khấu
    }
  }
};