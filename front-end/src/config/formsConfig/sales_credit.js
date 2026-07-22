/**
 * sales_credit.js - UI Schema cho nghiệp vụ Bán Chịu (Sales on Credit)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'sales_credit',
  eventName: 'Bán Chịu & Công Nợ Phải Thu',
  description: 'Nghiệp vụ bán hàng chịu (ghi nhận phải thu)',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'customer',
      title: 'Thông tin khách hàng',
      order: 2
    },
    {
      id: 'items',
      title: 'Sản phẩm/Dịch vụ',
      order: 3
    },
    {
      id: 'payment',
      title: 'Điều khoản thanh toán',
      order: 4
    }
  ],
  
  fields: [
    {
      id: 'invoice_number',
      section: 'general',
      type: 'TEXT',
      label: 'Số hóa đơn',
      required: true,
      placeholder: 'VD: INV-2024-001'
    },
    {
      id: 'invoice_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày hóa đơn',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'due_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày đến hạn',
      required: true,
      helpText: 'Ngày khách hàng phải thanh toán'
    },
    
    {
      id: 'partner_id',
      section: 'customer',
      type: 'SELECT',
      label: 'Khách hàng',
      required: true,
      source: '/api/partners?type=customer',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'credit_limit',
      section: 'customer',
      type: 'CURRENCY',
      label: 'Hạn mức công nợ (VND)',
      required: true,
      min: 0,
      readonly: true
    },
    {
      id: 'current_debt',
      section: 'customer',
      type: 'CURRENCY',
      label: 'Công nợ hiện tại (VND)',
      required: true,
      min: 0,
      readonly: true
    },
    {
      id: 'available_credit',
      section: 'customer',
      type: 'CURRENCY',
      label: 'Hạn mức còn lại (VND)',
      required: true,
      computed: true,
      computeFormula: 'credit_limit - current_debt'
    },
    
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
          min: 1
        },
        {
          field: 'unit_price',
          type: 'CURRENCY',
          label: 'Đơn giá (VND)',
          required: true,
          min: 0
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Thành tiền',
          required: true,
          computed: true
        }
      ]
    },
    
    {
      id: 'payment_terms',
      section: 'payment',
      type: 'SELECT',
      label: 'Điều khoản thanh toán',
      required: true,
      options: [
        { value: 'net_15', label: 'Net 15 ngày' },
        { value: 'net_30', label: 'Net 30 ngày' },
        { value: 'net_60', label: 'Net 60 ngày' },
        { value: 'net_90', label: 'Net 90 ngày' }
      ]
    },
    {
      id: 'total_amount',
      section: 'payment',
      type: 'CURRENCY',
      label: 'Tổng giá trị hóa đơn (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(items.amount)'
    }
  ],
  
  computedFields: {
    total_amount: 'SUM(items.amount)',
    available_credit: 'credit_limit - current_debt'
  },
  
  validation: {
    items: {
      minRows: 1,
      message: 'Phải có ít nhất 1 sản phẩm'
    },
    total_amount: {
      max: 'available_credit',
      message: 'Tổng giá trị vượt quá hạn mức công nợ còn lại'
    }
  },
  
  behavior: {
    autoCalculateTotal: true,
    checkCreditLimit: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn tạo hóa đơn bán chịu này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'sales_credit',
    accounting: {
      debit: ['AR'],
      credit: ['REVENUE', 'TAX_OUT']
    }
  }
};