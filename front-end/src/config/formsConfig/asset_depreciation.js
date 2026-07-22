/**
 * asset_depreciation.js - UI Schema cho nghiệp vụ Khấu hao TSCĐ
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'asset_depreciation',
  eventName: 'Khấu Hao Tài Sản Cố Định',
  description: 'Nghiệp vụ tính và ghi nhận khấu hao TSCĐ',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'assets',
      title: 'Danh sách tài sản',
      order: 2
    },
    {
      id: 'summary',
      title: 'Tổng hợp',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'depreciation_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày khấu hao',
      required: true,
      defaultValue: 'today',
      helpText: 'Ngày tính khấu hao'
    },
    {
      id: 'depreciation_type',
      section: 'general',
      type: 'SELECT',
      label: 'Loại khấu hao',
      required: true,
      defaultValue: 'monthly',
      options: [
        { value: 'monthly', label: 'Khấu hao tháng' },
        { value: 'quarterly', label: 'Khấu hao quý' },
        { value: 'yearly', label: 'Khấu hao năm' }
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
      id: 'assets',
      section: 'assets',
      type: 'SUB_GRID',
      label: 'Chi tiết tài sản khấu hao',
      required: true,
      minRows: 1,
      maxRows: 50,
      columns: [
        {
          field: 'asset_id',
          type: 'SELECT',
          label: 'Tài sản',
          required: true,
          source: '/api/fixed-assets',
          displayField: 'asset_name',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'original_cost',
          type: 'CURRENCY',
          label: 'Nguyên giá (VND)',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'accumulated_depreciation',
          type: 'CURRENCY',
          label: 'Khấu hao lũy kế (VND)',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'depreciation_rate',
          type: 'NUMBER',
          label: 'Tỷ lệ khấu hao (%)',
          required: true,
          min: 0,
          max: 100,
          step: 0.1
        },
        {
          field: 'depreciation_amount',
          type: 'CURRENCY',
          label: 'Số khấu hao kỳ này (VND)',
          required: true,
          min: 0,
          computed: true,
          computeFormula: 'original_cost * depreciation_rate / 100'
        },
        {
          field: 'remaining_value',
          type: 'CURRENCY',
          label: 'Giá trị còn lại (VND)',
          required: true,
          computed: true,
          computeFormula: 'original_cost - accumulated_depreciation - depreciation_amount'
        }
      ]
    },
    
    {
      id: 'total_depreciation',
      section: 'summary',
      type: 'CURRENCY',
      label: 'Tổng khấu hao kỳ này (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(assets.depreciation_amount)'
    }
  ],
  
  computedFields: {
    total_depreciation: 'SUM(assets.depreciation_amount)'
  },
  
  validation: {
    assets: {
      minRows: 1,
      message: 'Phải có ít nhất 1 tài sản'
    },
    'assets.depreciation_amount': {
      min: 0,
      message: 'Số khấu hao phải >= 0'
    }
  },
  
  behavior: {
    autoCalculateDepreciation: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn ghi nhận khấu hao này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'asset_depreciation',
    accounting: {
      debit: ['DEPRECIATION_EXPENSE'],
      credit: ['ACCUMULATED_DEPRECIATION']
    }
  }
};