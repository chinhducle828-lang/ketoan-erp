/**
 * payroll_distribution.js - UI Schema cho nghiệp vụ Phân Bổ Lương
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

export default {
  eventType: 'payroll_distribution',
  eventName: 'Phân Bổ Lương & BHXH',
  description: 'Nghiệp vụ tính lương, phân bổ chi phí nhân công',
  
  sections: [
    {
      id: 'general',
      title: 'Thông tin chung',
      order: 1
    },
    {
      id: 'employees',
      title: 'Danh sách nhân viên',
      order: 2
    },
    {
      id: 'allocation',
      title: 'Phân bổ chi phí',
      order: 3
    }
  ],
  
  fields: [
    {
      id: 'payroll_period',
      section: 'general',
      type: 'SELECT',
      label: 'Kỳ lương',
      required: true,
      source: '/api/payroll-periods',
      displayField: 'period_name',
      valueField: 'id',
      helpText: 'Chọn kỳ lương cần phân bổ'
    },
    {
      id: 'payment_date',
      section: 'general',
      type: 'DATE',
      label: 'Ngày thanh toán',
      required: true,
      defaultValue: 'today'
    },
    {
      id: 'total_gross',
      section: 'general',
      type: 'CURRENCY',
      label: 'Tổng lương gross (VND)',
      required: true,
      min: 0,
      computed: true
    },
    {
      id: 'total_net',
      section: 'general',
      type: 'CURRENCY',
      label: 'Tổng lương thực lĩnh (VND)',
      required: true,
      min: 0,
      computed: true
    },
    
    {
      id: 'employees',
      section: 'employees',
      type: 'SUB_GRID',
      label: 'Chi tiết lương nhân viên',
      required: true,
      minRows: 1,
      maxRows: 100,
      columns: [
        {
          field: 'employee_id',
          type: 'SELECT',
          label: 'Nhân viên',
          required: true,
          source: '/api/employees',
          displayField: 'full_name',
          valueField: 'id',
          searchable: true
        },
        {
          field: 'department',
          type: 'SELECT',
          label: 'Phòng ban',
          required: true,
          source: '/api/departments',
          displayField: 'name',
          valueField: 'id'
        },
        {
          field: 'gross_salary',
          type: 'CURRENCY',
          label: 'Lương gross',
          required: true,
          min: 0
        },
        {
          field: 'insurance_salary',
          type: 'CURRENCY',
          label: 'Lương đóng BHXH',
          required: true,
          min: 0
        },
        {
          field: 'net_salary',
          type: 'CURRENCY',
          label: 'Lương thực lĩnh',
          required: true,
          min: 0,
          computed: true
        }
      ]
    },
    
    {
      id: 'allocation_rules',
      section: 'allocation',
      type: 'SUB_GRID',
      label: 'Phân bổ chi phí theo phòng ban',
      required: true,
      minRows: 1,
      maxRows: 20,
      columns: [
        {
          field: 'department_id',
          type: 'SELECT',
          label: 'Phòng ban',
          required: true,
          source: '/api/departments',
          displayField: 'name',
          valueField: 'id'
        },
        {
          field: 'cost_center',
          type: 'SELECT',
          label: 'Cost center',
          required: true,
          source: '/api/cost-centers',
          displayField: 'name',
          valueField: 'id'
        },
        {
          field: 'allocation_percent',
          type: 'NUMBER',
          label: 'Tỷ lệ (%)',
          required: true,
          min: 0,
          max: 100
        },
        {
          field: 'amount',
          type: 'CURRENCY',
          label: 'Số tiền phân bổ',
          required: true,
          computed: true
        }
      ]
    }
  ],
  
  computedFields: {
    total_gross: 'SUM(employees.gross_salary)',
    total_net: 'SUM(employees.net_salary)',
    total_insurance: 'SUM(employees.insurance_salary)'
  },
  
  validation: {
    employees: {
      minRows: 1,
      message: 'Phải có ít nhất 1 nhân viên'
    },
    allocation_rules: {
      sumPercent: 100,
      message: 'Tổng tỷ lệ phân bổ phải = 100%'
    }
  },
  
  behavior: {
    autoCalculateTotals: true,
    confirmBeforeSubmit: true,
    confirmMessage: 'Bạn có chắc chắn muốn phân bổ lương này?'
  },
  
  backend: {
    endpoint: '/api/events',
    method: 'POST',
    eventType: 'payroll_distribution',
    accounting: {
      debit: ['ADMINISTRATIVE_EXPENSE', 'SELLING_EXPENSE', 'PRODUCTION_COST'],
      credit: ['PAYROLL_PAYABLE', 'BANK']
    }
  }
};