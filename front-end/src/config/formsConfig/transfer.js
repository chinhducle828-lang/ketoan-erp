/**
 * transfer.js - UI Schema cho nghiệp vụ Chuyển Kho Nội Bộ
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'transfer',
  eventName: 'Chuyển Kho Nội Bộ',
  description: 'Nghiệp vụ chuyển hàng giữa các kho nội bộ',
  
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
    }
  ],
  
  fields: [
    {
      id: 'transfer_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày chuyển',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'from_warehouse_id',
      section: 'general',
      type: 'SELECT',
      label: 'Kho xuất',
      required: true,
      source: '/api/warehouses',
      displayField: 'warehouse_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'to_warehouse_id',
      section: 'general',
      type: 'SELECT',
      label: 'Kho nhập',
      required: true,
      source: '/api/warehouses',
      displayField: 'warehouse_name',
      valueField: 'id',
      searchable: true
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
      label: 'Chi tiết hàng chuyển',
      required: true,
      minRows: 1,
      maxRows: 100,
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
          min: 0,
          readonly: true
        }
      ]
    }
  ],
  
  validation: {
    from_warehouse_id: {
      required: true,
      message: 'Vui lòng chọn kho xuất'
    },
    to_warehouse_id: {
      required: true,
      message: 'Vui lòng chọn kho nhập'
    },
    items: {
      minRows: 1,
      message: 'Phải có ít nhất 1 hàng hóa'
    }
  },
  
  behavior: {
    autoValidateWarehouses: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn chuyển kho này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'transfer',
    accounting: {
      debit: ['INVENTORY_TRANSFER'],
      credit: ['INVENTORY_TRANSFER']
    }
  }
};