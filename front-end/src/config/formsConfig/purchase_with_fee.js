/**
 * purchase_with_fee.js - UI Schema cho nghiệp vụ Mua Hàng Có Phí
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'purchase_with_fee',
  eventName: 'Mua Hàng Có Phí Phát Sinh',
  description: 'Nghiệp vụ mua hàng kèm phí vận chuyển, bảo hiểm',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'items',
      title: 'Chi tiết hàng hóa',
      order: 2
    },
    {
      id: 'fees',
      title: 'Phí phát sinh',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'partner_id',
      section: 'general',
      type: 'SELECT',
      label: 'Nhà cung cấp',
      required: true,
      source: '/api/partners?type=supplier',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
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
      id: 'currency',
      section: 'general',
      type: 'SELECT',
      label: 'Loại tiền',
      required: true,
      defaultValue: 'VND',
      options: [
        { value: 'VND', label: 'VND' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' }
      ]
    },
    {
      id: 'exchange_rate',
      section: 'general',
      type: 'NUMBER',
      label: 'Tỷ giá',
      required: true,
      min: 0,
      step: 0.01,
      defaultValue: 1
    },
    
    {
      id: 'items',
      section: 'items',
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
      id: 'shipping_fee',
      section: 'fees',
      type: 'CURRENCY',
      label: 'Phí vận chuyển (VND)',
      required: false,
      min: 0,
      defaultValue: 0
    },
    {
      id: 'insurance_fee',
      section: 'fees',
      type: 'CURRENCY',
      label: 'Phí bảo hiểm (VND)',
      required: false,
      min: 0,
      defaultValue: 0
    },
    {
      id: 'customs_fee',
      section: 'fees',
      type: 'CURRENCY',
      label: 'Phí hải quan (VND)',
      required: false,
      min: 0,
      defaultValue: 0
    },
    {
      id: 'other_fees',
      section: 'fees',
      type: 'CURRENCY',
      label: 'Phí khác (VND)',
      required: false,
      min: 0,
      defaultValue: 0
    },
    {
      id: 'total_fees',
      section: 'fees',
      type: 'CURRENCY',
      label: 'Tổng phí (VND)',
      required: true,
      computed: true,
      computeFormula: 'shipping_fee + insurance_fee + customs_fee + other_fees'
    }
  ],
  
  computedFields: {
    total_amount: 'SUM(items.amount) + total_fees',
    total_fees: 'shipping_fee + insurance_fee + customs_fee + other_fees'
  },
  
  validation: {
    items: {
      minRows: 1,
      message: 'Phải có ít nhất 1 sản phẩm'
    }
  },
  
  behavior: {
    autoCalculateFees: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn lưu nghiệp vụ này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'purchase_with_fee',
    accounting: {
      debit: ['INVENTORY', 'RAW_MATERIAL'],
      credit: ['AP', 'BANK']
    }
  }
};