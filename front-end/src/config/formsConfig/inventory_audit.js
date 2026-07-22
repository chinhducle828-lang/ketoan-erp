/**
 * inventory_audit.js - UI Schema cho nghiệp vụ Kiểm Kê Kho
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'inventory_audit',
  eventName: 'Kiểm Kê Kho',
  description: 'Nghiệp vụ kiểm kê thực tế kho hàng',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'items',
      title: 'Chi tiết kiểm kê',
      order: 2
    },
    {
      id: 'adjustment',
      title: 'Điều chỉnh',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'warehouse_id',
      section: 'general',
      type: 'SELECT',
      label: 'Kho kiểm kê',
      required: true,
      source: '/api/warehouses',
      displayField: 'warehouse_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'audit_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày kiểm kê',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'audit_type',
      section: 'general',
      type: 'SELECT',
      label: 'Loại kiểm kê',
      required: true,
      defaultValue: 'periodic',
      options: [
        { value: 'periodic', label: 'Kiểm kê định kỳ' },
        { value: 'sudden', label: 'Kiểm kê đột xuất' },
        { value: 'annual', label: 'Kiểm kê năm' }
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
      id: 'items',
      section: 'items',
      type: 'SUB_GRID',
      label: 'Chi tiết hàng hóa kiểm kê',
      required: true,
      minRows: 1,
      maxRows: 200,
      columns: [
        {
          field: 'item_id',
          type: 'SELECT',
          label: 'Hàng hóa',
          required: true,
          source: '/api/items',
          displayField: 'name',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'system_quantity',
          type: 'NUMBER',
          label: 'Số lượng hệ thống',
          required: true,
          min: 0,
          readonly: true
        },
        {
          field: 'actual_quantity',
          type: 'NUMBER',
          label: 'Số lượng thực tế',
          required: true,
          min: 0
        },
        {
          field: 'difference',
          type: 'NUMBER',
          label: 'Chênh lệch',
          required: true,
          computed: true,
          computeFormula: 'actual_quantity - system_quantity'
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
          field: 'difference_value',
          type: 'CURRENCY',
          label: 'Giá trị chênh lệch (VND)',
          required: true,
          computed: true,
          computeFormula: 'difference * unit_price'
        }
      ]
    },
    
    {
      id: 'total_surplus',
      section: 'adjustment',
      type: 'CURRENCY',
      label: 'Tổng thừa (VND)',
      required: false,
      computed: true,
      computeFormula: 'SUM(IF(items.difference > 0, items.difference_value, 0))'
    },
    {
      id: 'total_shortage',
      section: 'adjustment',
      type: 'CURRENCY',
      label: 'Tổng thiếu (VND)',
      required: false,
      computed: true,
      computeFormula: 'SUM(IF(items.difference < 0, ABS(items.difference_value), 0))'
    },
    {
      id: 'adjustment_account',
      section: 'adjustment',
      type: 'SELECT',
      label: 'Tài khoản điều chỉnh',
      required: true,
      options: [
        { value: 'inventory_gain', label: 'Thu nhập khác (TK 711)' },
        { value: 'inventory_loss', label: 'Chi phí khác (TK 811)' }
      ],
      helpText: 'Tài khoản ghi nhận chênh lệch kiểm kê'
    }
  ],
  
  computedFields: {
    total_surplus: 'SUM(IF(items.difference > 0, items.difference_value, 0))',
    total_shortage: 'SUM(IF(items.difference < 0, ABS(items.difference_value), 0))'
  },
  
  validation: {
    items: {
      minRows: 1,
      message: 'Phải có ít nhất 1 hàng hóa'
    }
  },
  
  behavior: {
    autoCalculateDifference: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn ghi nhận kiểm kê này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'inventory_audit',
    accounting: {
      debit: ['INVENTORY', 'INVENTORY_LOSS'],
      credit: ['INVENTORY', 'INVENTORY_GAIN']
    }
  }
};