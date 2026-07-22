/**
 * retroactive_rebate.js - UI Schema cho nghiệp vụ Chiết Khấu Hậu Mãi
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'retroactive_rebate',
  eventName: 'Chiết Khấu Hậu Mãi',
  description: 'Nghiệp vụ chiết khấu thương mại sau khi bán hàng',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'invoices',
      title: 'Hóa đơn áp dụng',
      order: 2
    },
    {
      id: 'rebate',
      title: 'Chiết khấu',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'partner_id',
      section: 'general',
      type: 'SELECT',
      label: 'Khách hàng/NCC',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'rebate_type',
      section: 'general',
      type: 'SELECT',
      label: 'Loại chiết khấu',
      required: true,
      options: [
        { value: 'volume', label: 'Chiết khấu số lượng' },
        { value: 'value', label: 'Chiết khấu theo giá trị' },
        { value: 'special', label: 'Chiết khấu đặc biệt' }
      ]
    },
    {
      id: 'rebate_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày chiết khấu',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'description',
      section: 'general',
      type: 'TEXTAREA',
      label: 'Diễn giải',
      required: true,
      rows: 2
    },
    
    {
      id: 'invoices',
      section: 'invoices',
      type: 'SUB_GRID',
      label: 'Danh sách hóa đơn',
      required: true,
      minRows: 1,
      maxRows: 50,
      columns: [
        {
          field: 'invoice_id',
          type: 'SELECT',
          label: 'Hóa đơn',
          required: true,
          source: '/api/invoices',
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
          field: 'rebate_percent',
          type: 'NUMBER',
          label: 'Tỷ lệ chiết khấu (%)',
          required: true,
          min: 0,
          max: 100
        },
        {
          field: 'rebate_amount',
          type: 'CURRENCY',
          label: 'Tiền chiết khấu',
          required: true,
          computed: true,
          computeFormula: 'invoice_amount * rebate_percent / 100'
        }
      ]
    },
    
    {
      id: 'total_rebate',
      section: 'rebate',
      type: 'CURRENCY',
      label: 'Tổng chiết khấu (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(invoices.rebate_amount)'
    }
  ],
  
  computedFields: {
    total_rebate: 'SUM(invoices.rebate_amount)'
  },
  
  validation: {
    invoices: {
      minRows: 1,
      message: 'Phải có ít nhất 1 hóa đơn'
    }
  },
  
  behavior: {
    autoCalculateRebate: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn áp dụng chiết khấu này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'retroactive_rebate',
    accounting: {
      debit: ['REBATE_EXPENSE', 'SALES_REBATE'],
      credit: ['AR', 'CASH']
    }
  }
};