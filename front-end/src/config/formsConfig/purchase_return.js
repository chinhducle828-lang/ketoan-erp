/**
 * purchase_return.js - UI Schema cho nghiệp vụ Trả Hàng Mua
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'purchase_return',
  eventName: 'Trả Hàng Mua',
  description: 'Nghiệp vụ trả hàng cho nhà cung cấp',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'original_invoice',
      title: 'Hóa đơn mua gốc',
      order: 2
    },
    {
      id: 'return_items',
      title: 'Hàng trả',
      order: 3
    },
    {
      id: 'refund',
      title: 'Hoàn tiền',
      order: 4
    }
  ],
  
  fields: [
    {
      id: 'return_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày trả hàng',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'return_reason',
      section: 'general',
      type: 'SELECT',
      label: 'Lý do trả hàng',
      required: true,
      options: [
        { value: 'defective', label: 'Hàng lỗi' },
        { value: 'wrong_item', label: 'Giao nhầm hàng' },
        { value: 'not_as_described', label: 'Không đúng mô tả' },
        { value: 'excess', label: 'Hàng thừa' }
      ]
    },
    {
      id: 'description',
      section: 'general',
      type: 'TEXTAREA',
      label: 'Diễn giải chi tiết',
      required: true,
      rows: 3
    },
    
    {
      id: 'original_invoice_id',
      section: 'original_invoice',
      type: 'SELECT',
      label: 'Hóa đơn mua gốc',
      required: true,
      source: '/api/invoices?type=purchase',
      displayField: 'invoice_number',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'partner_id',
      section: 'original_invoice',
      type: 'SELECT',
      label: 'Nhà cung cấp',
      required: true,
      source: '/api/partners?type=supplier',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true,
      readonly: true
    },
    
    {
      id: 'return_items',
      section: 'return_items',
      type: 'SUB_GRID',
      label: 'Chi tiết hàng trả',
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
          label: 'Số lượng trả',
          required: true,
          min: 1
        },
        {
          field: 'unit_price',
          type: 'CURRENCY',
          label: 'Đơn giá (VND)',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Thành tiền',
          required: true,
          computed: true,
          computeFormula: 'quantity * unit_price'
        }
      ]
    },
    
    {
      id: 'refund_amount',
      section: 'refund',
      type: 'CURRENCY',
      label: 'Số tiền hoàn trả (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(return_items.amount)'
    },
    {
      id: 'refund_method',
      section: 'refund',
      type: 'SELECT',
      label: 'Phương thức hoàn tiền',
      required: true,
      options: [
        { value: 'cash', label: 'Tiền mặt' },
        { value: 'bank_transfer', label: 'Chuyển khoản' },
        { value: 'credit_note', label: 'Ghi công nợ (Credit Note)' }
      ]
    }
  ],
  
  computedFields: {
    refund_amount: 'SUM(return_items.amount)'
  },
  
  validation: {
    return_items: {
      minRows: 1,
      message: 'Phải có ít nhất 1 sản phẩm trả'
    }
  },
  
  behavior: {
    autoCalculateRefund: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn xác nhận trả hàng này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'purchase_return',
    accounting: {
      debit: ['AP', 'INVENTORY'],
      credit: ['INVENTORY', 'PURCHASE_RETURN']
    }
  }
};