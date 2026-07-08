/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * CẤU HÌNH WORKFLOW KẾT CHUYỂN SỔ - ERP KẾ TOÁN
 * Chuẩn Thông tư 99/2025/TT-BTC
 */

// Cấu hình các bước kết chuyển sổ
export const CLOSING_WORKFLOW = {
  steps: [
    {
      id: 'inventory_costing',
      name: 'Tính giá vốn kho',
      description: 'Tính giá vốn xuất kho bằng phương pháp bình quân gia quyền',
      service: 'inventory.service',
      function: 'calculateWeightedAverageCost',
      required: true
    },
    {
      id: 'logistic_allocation',
      name: 'Phân bổ chi phí logistics',
      description: 'Phân bổ chi phí mua hàng hóa vào nguyên giá',
      service: 'inventory.service',
      function: 'allocateLogisticCosts',
      required: true
    },
    {
      id: 'depreciation',
      name: 'Khấu hao TSCĐ',
      description: 'Tính khấu hao tài sản cố định',
      service: 'closing.service',
      function: 'createDepreciationEntries',
      required: true
    },
    {
      id: 'allowance',
      name: 'Phân bổ chi phí trả trước',
      description: 'Phân bổ chi phí trả trước vào chi phí hoạt động',
      service: 'closing.service',
      function: 'createAllowanceEntries',
      required: false
    },
    {
      id: 'provision',
      name: 'Dự phòng nợ khó đòi',
      description: 'Dự phòng 10% số dư phải thu quá hạn',
      service: 'closing.service',
      function: 'createProvisionEntries',
      required: false
    },
    {
      id: 'tax_vat',
      name: 'Xử lý thuế VAT',
      description: 'Nộp thuế GTGT phải nộp',
      service: 'closing.service',
      function: 'processTaxVAT',
      required: true
    },
    {
      id: 'tax_tncn',
      name: 'Xử lý thuế TNCN',
      description: 'Nộp thuế thu nhập cá nhân',
      service: 'closing.service',
      function: 'processTaxTNCN',
      required: true
    },
    {
      id: 'closing_entries',
      name: 'Kết chuyển sổ',
      description: 'Kết chuyển doanh thu, chi phí sang TK 911',
      service: 'closing.service',
      function: 'runClosingEntries',
      required: true
    }
  ],
  
  // Cấu hình thuế suất
  taxRates: {
    corporate: {
      threshold1: 3000000000, // 3 tỷ
      rate1: 0.15,
      threshold2: 50000000000, // 50 tỷ
      rate2: 0.17,
      rate3: 0.20
    },
    vat: 0.1, // 10%
    minimumCorporateTax: 0.015 // 15% thuế tối thiểu TNDN
  },
  
  // Cấu hình tài khoản
  accounts: {
    revenue: '511',
    costOfGoodsSold: '632',
    operatingExpenses: ['641', '642'],
    otherIncome: '711',
    otherExpenses: '811',
    profitLoss: '911',
    retainedEarnings: '4212',
    corporateTax: '821',
    corporateTaxPayable: '3334',
    vatPayable: '3331',
    incomeTaxPayable: '3331',
    accountsPayable: '331'
  }
};

// Hàm lấy cấu hình workflow
export function getClosingWorkflow() {
  return CLOSING_WORKFLOW;
}

// Hàm lấy thuế suất theo doanh thu
export function getTaxRateByRevenue(revenue) {
  if (revenue <= CLOSING_WORKFLOW.taxRates.corporate.threshold1) {
    return CLOSING_WORKFLOW.taxRates.corporate.rate1;
  }
  if (revenue <= CLOSING_WORKFLOW.taxRates.corporate.threshold2) {
    return CLOSING_WORKFLOW.taxRates.corporate.rate2;
  }
  return CLOSING_WORKFLOW.taxRates.corporate.rate3;
}

// Hàm lấy thông tin bước kết chuyển
export function getClosingStep(stepId) {
  return CLOSING_WORKFLOW.steps.find(step => step.id === stepId);
}

// Hàm lấy tất cả bước bắt buộc
export function getRequiredSteps() {
  return CLOSING_WORKFLOW.steps.filter(step => step.required);
}