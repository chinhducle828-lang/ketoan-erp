/**
 * quad_party_netting.js - UI Schema cho nghiệp vụ Cấn Trừ 4 Bên
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'quad_party_netting',
  eventName: 'Cấn Trừ Công Nợ 4 Bên',
  description: 'Nghiệp vụ cấn trừ công nợ giữa 4 bên (A→B→C→D→A)',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'parties',
      title: 'Các bên tham gia',
      order: 2
    },
    {
      id: 'debts',
      title: 'Công nợ cấn trừ',
      order: 3
    },
    {
      id: 'settlement',
      title: 'Thanh toán chênh lệch',
      order: 4
    }
  ],
  
  fields: [
    {
      id: 'netting_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày cấn trừ',
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
      id: 'party_a',
      section: 'parties',
      type: 'SELECT',
      label: 'Bên A (Công ty)',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'party_b',
      section: 'parties',
      type: 'SELECT',
      label: 'Bên B',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'party_c',
      section: 'parties',
      type: 'SELECT',
      label: 'Bên C',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'party_d',
      section: 'parties',
      type: 'SELECT',
      label: 'Bên D',
      required: true,
      source: '/api/partners',
      displayField: 'partner_name',
      valueField: 'id',
      searchable: true
    },
    
    {
      id: 'debts',
      section: 'debts',
      type: 'SUB_GRID',
      label: 'Công nợ giữa các bên',
      required: true,
      minRows: 4,
      maxRows: 10,
      columns: [
        {
          field: 'from_party',
          type: 'SELECT',
          label: 'Bên nợ',
          required: true,
          source: '/api/partners',
          displayField: 'partner_name',
          valueField: 'id'
        },
        {
          field: 'to_party',
          type: 'SELECT',
          label: 'Bên có',
          required: true,
          source: '/api/partners',
          displayField: 'partner_name',
          valueField: 'id'
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Số tiền (VND)',
          required: true,
          min: 0
        },
        {
          field: 'invoice_id',
          type: 'SELECT',
          label: 'Hóa đơn',
          required: true,
          source: '/api/invoices',
          displayField: 'invoice_number',
          valueField: 'id'
        }
      ]
    },
    
    {
      id: 'total_netting',
      section: 'settlement',
      type: 'CURRENCY',
      label: 'Tổng cấn trừ (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(debts.amount)'
    },
    {
      id: 'net_settlement',
      section: 'settlement',
      type: 'CURRENCY',
      label: 'Thanh toán chênh lệch (VND)',
      required: true,
      computed: true,
      helpText: 'Số tiền thực tế cần thanh toán sau cấn trừ'
    },
    {
      id: 'payment_method',
      section: 'settlement',
      type: 'SELECT',
      label: 'Phương thức thanh toán',
      required: true,
      options: [
        { value: 'bank_transfer', label: 'Chuyển khoản' },
        { value: 'cash', label: 'Tiền mặt' }
      ]
    }
  ],
  
  computedFields: {
    total_netting: 'SUM(debts.amount)'
  },
  
  validation: {
    debts: {
      minRows: 4,
      message: 'Phải có ít nhất 4 khoản công nợ'
    },
    party_a: {
      required: true,
      message: 'Phải chọn Bên A'
    }
  },
  
  behavior: {
    autoCalculateTotal: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn thực hiện cấn trừ này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'quad_party_netting',
    accounting: {
      debit: ['AR', 'AP'],
      credit: ['AR', 'AP']
    }
  }
};