/**
 * simple_expense.js - UI Schema cho nghiệp vụ Chi Phí Vận Hành
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'simple_expense',
  eventName: 'Chi Phí Vận Hành',
  description: 'Nghiệp vụ chi phí vận hành hành chính, bán hàng, quản lý',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'expense_details',
      title: 'Chi tiết chi phí',
      order: 2
    },
    {
      id: 'payment',
      title: 'Thanh toán',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'expense_type',
      section: 'general',
      type: 'SELECT',
      label: 'Loại chi phí',
      required: true,
      options: [
        { value: 'administrative', label: 'Chi phí quản lý doanh nghiệp (TK 641)' },
        { value: 'selling', label: 'Chi phí bán hàng (TK 642)' },
        { value: 'other', label: 'Chi phí khác' }
      ],
      helpText: 'Phân loại chi phí theo báo cáo KQKD'
    },
    {
      id: 'expense_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày phát sinh',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'description',
      section: 'general',
      type: 'TEXTAREA',
      label: 'Diễn giải',
      required: true,
      rows: 3,
      placeholder: 'Mô tả chi phí...'
    },
    
    {
      id: 'vendor_id',
      section: 'expense_details',
      type: 'SELECT',
      label: 'Nhà cung cấp dịch vụ',
      required: false,
      source: '/api/partners?type=supplier',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'amount',
      section: 'expense_details',
      type: 'CURRENCY',
      label: 'Số tiền (VND)',
      required: true,
      min: 0,
      step: 1000
    },
    {
      id: 'tax_amount',
      section: 'expense_details',
      type: 'CURRENCY',
      label: 'Thuế GTGT (VND)',
      required: false,
      min: 0,
      defaultValue: 0
    },
    
    {
      id: 'payment_method',
      section: 'payment',
      type: 'SELECT',
      label: 'Phương thức thanh toán',
      required: true,
      defaultValue: 'cash',
      options: [
        { value: 'cash', label: 'Tiền mặt' },
        { value: 'bank_transfer', label: 'Chuyển khoản' }
      ]
    },
    {
      id: 'payment_date',
      section: 'payment',
      type: 'DATE',
      label: 'Ngày thanh toán',
      required: true,
      defaultValue: 'today'
    }
  ],
  
  computedFields: {
    total_amount: 'amount + tax_amount'
  },
  
  validation: {
    amount: {
      min: 1000,
      message: 'Số tiền phải >= 1,000 VND'
    },
    description: {
      minLength: 5,
      message: 'Diễn giải phải có ít nhất 5 ký tự'
    }
  },
  
  behavior: {
    autoCalculateTotal: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn ghi nhận chi phí này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'simple_expense',
    accounting: {
      debit: ['ADMINISTRATIVE_EXPENSE', 'SELLING_EXPENSE'],
      credit: ['CASH', 'BANK', 'AP']
    }
  }
};