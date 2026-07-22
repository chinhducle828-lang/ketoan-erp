/**
 * factoring.js - UI Schema cho nghiệp vụ Chiết Khấu Hóa Đơn (Factoring)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'factoring',
  eventName: 'Chiết Khấu Hóa Đơn (Factoring)',
  description: 'Nghiệp vụ chiết khấu hóa đơn tại ngân hàng (có/không truy đòi)',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'invoices',
      title: 'Hóa đơn chiết khấu',
      order: 2
    },
    {
      id: 'factoring',
      title: 'Chi tiết factoring',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'partner_id',
      section: 'general',
      type: 'SELECT',
      label: 'Khách hàng (bên bán)',
      required: true,
      source: '/api/partners?type=customer',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'bank_id',
      section: 'general',
      type: 'SELECT',
      label: 'Ngân hàng mua hóa đơn',
      required: true,
      source: '/api/banks',
      displayField: 'bank_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'factoring_type',
      section: 'general',
      type: 'SELECT',
      label: 'Loại factoring',
      required: true,
      defaultValue: 'with_recourse',
      options: [
        { value: 'with_recourse', label: 'Có truy đòi (With Recourse)' },
        { value: 'without_recourse', label: 'Không truy đòi (Without Recourse)' }
      ],
      helpText: 'Có truy đòi: Bên bán vẫn chịu rủi ro nếu khách hàng không trả'
    },
    {
      id: 'factoring_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày chiết khấu',
      required: true,
      defaultValue: 'today'
    },
    
    {
      id: 'invoices',
      section: 'invoices',
      type: 'SUB_GRID',
      label: 'Danh sách hóa đơn',
      required: true,
      minRows: 1,
      maxRows: 20,
      columns: [
        {
          field: 'invoice_id',
          type: 'SELECT',
          label: 'Hóa đơn',
          required: true,
          source: '/api/invoices?status=approved',
          displayField: 'invoice_number',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'invoice_amount',
          type: 'CURRENCY',
          label: 'Giá trị hóa đơn',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'due_date',
          type: 'DATE',
          label: 'Ngày đáo hạn',
          required: true,
          readonly: true
        }
      ]
    },
    
    {
      id: 'total_invoice_amount',
      section: 'factoring',
      type: 'CURRENCY',
      label: 'Tổng giá trị hóa đơn (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(invoices.invoice_amount)'
    },
    {
      id: 'factoring_fee_percent',
      section: 'factoring',
      type: 'NUMBER',
      label: 'Phí factoring (%)',
      required: true,
      min: 0,
      max: 100,
      step: 0.1,
      defaultValue: 3,
      helpText: 'Phí chiết khấu (thường 2-5%)'
    },
    {
      id: 'factoring_fee_amount',
      section: 'factoring',
      type: 'CURRENCY',
      label: 'Phí factoring (VND)',
      required: true,
      computed: true,
      computeFormula: 'total_invoice_amount * factoring_fee_percent / 100'
    },
    {
      id: 'advance_percent',
      section: 'factoring',
      type: 'NUMBER',
      label: 'Tỷ lệ ứng trước (%)',
      required: true,
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 80,
      helpText: 'Tỷ lệ ngân hàng ứng trước (thường 70-90%)'
    },
    {
      id: 'advance_amount',
      section: 'factoring',
      type: 'CURRENCY',
      label: 'Số tiền ứng trước (VND)',
      required: true,
      computed: true,
      computeFormula: 'total_invoice_amount * advance_percent / 100'
    },
    {
      id: 'reserve_amount',
      section: 'factoring',
      type: 'CURRENCY',
      label: 'Tiền giữ lại (VND)',
      required: true,
      computed: true,
      computeFormula: 'total_invoice_amount - advance_amount - factoring_fee_amount'
    }
  ],
  
  computedFields: {
    total_invoice_amount: 'SUM(invoices.invoice_amount)',
    factoring_fee_amount: 'total_invoice_amount * factoring_fee_percent / 100',
    advance_amount: 'total_invoice_amount * advance_percent / 100',
    reserve_amount: 'total_invoice_amount - advance_amount - factoring_fee_amount'
  },
  
  validation: {
    invoices: {
      minRows: 1,
      message: 'Phải có ít nhất 1 hóa đơn'
    },
    factoring_fee_percent: {
      min: 0,
      max: 100,
      message: 'Phí factoring phải từ 0% đến 100%'
    }
  },
  
  behavior: {
    autoCalculateFees: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn thực hiện factoring này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'factoring',
    accounting: {
      // With Recourse: Nợ TK 1121 / Có TK 331 + TK 633
      // Without Recourse: Nợ TK 1121 / Có TK 331 + TK 633 (không ghi TK 311)
      debit: ['BANK'],
      credit: ['AR', 'FACTORING_FEE']
    }
  }
};