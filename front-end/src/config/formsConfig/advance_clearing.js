/**
 * advance_clearing.js - UI Schema cho nghiệp vụ Quyết Toán Tạm Ứng
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'advance_clearing',
  eventName: 'Quyết Toán Tạm Ứng',
  description: 'Nghiệp vụ quyết toán khoản tạm ứng cho nhân viên',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'expenses',
      title: 'Chi tiết chi phí',
      order: 2
    },
    {
      id: 'settlement',
      title: 'Thanh toán',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'employee_id',
      section: 'general',
      type: 'SELECT',
      label: 'Nhân viên',
      required: true,
      source: '/api/employees',
      displayField: 'full_name',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'advance_id',
      section: 'general',
      type: 'SELECT',
      label: 'Khoản tạm ứng',
      required: true,
      source: '/api/advances',
      displayField: 'advance_number',
      valueField: 'id',
      searchable: true
    },
    {
      id: 'advance_amount',
      section: 'general',
      type: 'CURRENCY',
      label: 'Số tạm ứng (VND)',
      required: true,
      min: 0,
      readonly: true
    },
    {
      id: 'clearing_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày quyết toán',
      required: true,
      defaultValue: 'today'
    },
    
    {
      id: 'expenses',
      section: 'expenses',
      type: 'SUB_GRID',
      label: 'Chi tiết chi phí',
      required: true,
      minRows: 1,
      maxRows: 20,
      columns: [
        {
          field: 'expense_type',
          type: 'SELECT',
          label: 'Loại chi phí',
          required: true,
          options: [
            { value: 'transport', label: 'Đi lại' },
            { value: 'accommodation', label: 'Lưu trú' },
            { value: 'meals', label: 'Ăn uống' },
            { value: 'other', label: 'Khác' }
          ]
        },
        {
          field: 'description',
          type: 'TEXT',
          label: 'Diễn giải',
          required: true
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Số tiền (VND)',
          required: true,
          min: 0
        },
        {
          field: 'invoice_number',
          type: 'TEXT',
          label: 'Số hóa đơn',
          required: false
        }
      ]
    },
    
    {
      id: 'total_expenses',
      section: 'settlement',
      type: 'CURRENCY',
      label: 'Tổng chi phí (VND)',
      required: true,
      computed: true,
      computeFormula: 'SUM(expenses.amount)'
    },
    {
      id: 'refund_amount',
      section: 'settlement',
      type: 'CURRENCY',
      label: 'Hoàn trả cho công ty (VND)',
      required: true,
      computed: true,
      computeFormula: 'advance_amount - total_expenses'
    },
    {
      id: 'payment_method',
      section: 'settlement',
      type: 'SELECT',
      label: 'Phương thức hoàn trả',
      required: true,
      options: [
        { value: 'cash', label: 'Tiền mặt' },
        { value: 'bank_transfer', label: 'Chuyển khoản' }
      ]
    }
  ],
  
  computedFields: {
    total_expenses: 'SUM(expenses.amount)',
    refund_amount: 'advance_amount - total_expenses'
  },
  
  validation: {
    expenses: {
      minRows: 1,
      message: 'Phải có ít nhất 1 chi phí'
    }
  },
  
  behavior: {
    autoCalculateTotal: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn quyết toán tạm ứng này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'advance_clearing',
    accounting: {
      debit: ['ADVANCE_CLEARING_EXPENSE'],
      credit: ['CASH', 'BANK', 'ADVANCE_TO_EMPLOYEES']
    }
  }
};