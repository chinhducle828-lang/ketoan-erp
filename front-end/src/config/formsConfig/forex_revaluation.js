/**
 * forex_revaluation.js - UI Schema cho nghiệp vụ Đánh Giá Lại Tỷ Giá
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'forex_revaluation',
  eventName: 'Đánh Giá Lại Tỷ Giá Ngoại Tệ',
  description: 'Nghiệp vụ đánh giá lại các khoản ngoại tệ cuối kỳ',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'accounts',
      title: 'Tài khoản đánh giá lại',
      order: 2
    },
    {
      id: 'rates',
      title: 'Tỷ giá',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'revaluation_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày đánh giá lại',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'currency',
      section: 'general',
      type: 'SELECT',
      label: 'Ngoại tệ',
      required: true,
      options: [
        { value: 'USD', label: 'USD - US Dollar' },
        { value: 'EUR', label: 'EUR - Euro' },
        { value: 'GBP', label: 'GBP - British Pound' },
        { value: 'JPY', label: 'JPY - Japanese Yen' },
        { value: 'CNY', label: 'CNY - Chinese Yuan' }
      ]
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
      id: 'accounts',
      section: 'accounts',
      type: 'SUB_GRID',
      label: 'Tài khoản đánh giá lại',
      required: true,
      minRows: 1,
      maxRows: 50,
      columns: [
        {
          field: 'account_code',
          type: 'SELECT',
          label: 'Tài khoản',
          required: true,
          source: '/api/accounts?type=forex',
          displayField: 'account_name',
          valueField: 'account_code',
          searchable: true
        },
        {
          field: 'original_amount',
          type: 'CURRENCY',
          label: 'Số dư đầu kỳ (VND)',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'original_quantity',
          section: 'accounts',
          type: 'NUMBER',
          label: 'Số dư ngoại tệ',
          required: true,
          readonly: true
        }
      ]
    },
    
    {
      id: 'old_rate',
      section: 'rates',
      type: 'NUMBER',
      label: 'Tỷ giá đầu kỳ',
      required: true,
      min: 0,
      step: 0.01
    },
    {
      id: 'new_rate',
      section: 'rates',
      type: 'NUMBER',
      label: 'Tỷ giá cuối kỳ',
      required: true,
      min: 0,
      step: 0.01
    },
    {
      id: 'revaluation_amount',
      section: 'rates',
      type: 'CURRENCY',
      label: 'Chênh lệch tỷ giá (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(accounts.original_quantity) * (new_rate - old_rate)'
    }
  ],
  
  computedFields: {
    revaluation_amount: 'SUM(accounts.original_quantity) * (new_rate - old_rate)'
  },
  
  validation: {
    new_rate: {
      min: 0,
      message: 'Tỷ giá phải > 0'
    }
  },
  
  behavior: {
    autoCalculateRevaluation: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn đánh giá lại tỷ giá này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'forex_revaluation',
    accounting: {
      debit: ['FOREIGN_CURRENCY', 'EXCHANGE_GAIN'],
      credit: ['FOREIGN_CURRENCY', 'EXCHANGE_LOSS']
    }
  }
};