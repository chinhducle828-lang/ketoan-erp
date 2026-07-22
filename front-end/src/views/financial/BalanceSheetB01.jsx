/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { FileText, CheckCircle2, AlertCircle, Download, Info } from 'lucide-react';
import { useRealtimeCacheSync } from '../../hooks/useRealtimeCacheSync.js';

// ====================================================================
// CẤU HÌNH BẢNG CÂN ĐỐI KẾ TOÁN B01-DN
// Theo Thông tư 99/2025/TT-BTC
// 
// QUY TẮC HIỂN THỊ:
// - type='debit': Tài khoản thuần Nợ (Tài sản) → hiển thị bên Nợ
// - type='credit': Tài khoản thuần Có (Nguồn vốn) → hiển thị bên Có
// - type='hermaphroditic': Tài khoản lưỡng tính (131, 331, 138, 338) → bóc tách theo đối tác
// - type='contra-asset': Tài khoản đối tài (214, 229) → hiển thị âm (...) bên Tài sản
// - type='contra-equity': Tài khoản đối vốn (419) → hiển thị âm (...) bên VCSH
// ====================================================================
const ACCOUNT_GROUPS = {
  assets: {
    title: 'A. TÀI SẢN NGẮN HẠN (100=110+120+130+140+150)',
    code: '1,2',
    accounts: [
      { code: '110', name: 'Tiền và tương đương tiền', type: 'debit', isTotal: true },
      { code: '111', name: '  Tiền mặt', type: 'debit', parentCode: '110' },
      { code: '112', name: '  Tiền gửi ngân hàng', type: 'debit', parentCode: '110' },
      { code: '120', name: 'Đầu tư tài chính ngắn hạn', type: 'debit', isTotal: true },
      { code: '121', name: '  Chứng khoán kinh doanh', type: 'debit', parentCode: '120' },
      { code: '128', name: '  Đầu tư nắm giữ đến ngày đáo hạn', type: 'debit', parentCode: '120' },
      { code: '130', name: 'Các khoản phải thu ngắn hạn', type: 'debit', isTotal: true },
      { code: '131', name: '  Phải thu khách hàng', type: 'hermaphroditic', parentCode: '130' },
      { code: '133', name: '  Thuế GTGT được khấu trừ', type: 'debit', parentCode: '130' },
      { code: '136', name: '  Phải thu nội bộ', type: 'debit', parentCode: '130' },
      { code: '138', name: '  Phải thu khác', type: 'hermaphroditic', parentCode: '130' },
      { code: '141', name: '  Tạm ứng', type: 'debit', parentCode: '130' },
      { code: '140', name: 'Hàng tồn kho', type: 'debit', isTotal: true },
      { code: '151', name: '  Hàng mua đang đi đường', type: 'debit', parentCode: '140' },
      { code: '152', name: '  Nguyên liệu, vật liệu', type: 'debit', parentCode: '140' },
      { code: '153', name: '  Công cụ, dụng cụ', type: 'debit', parentCode: '140' },
      { code: '154', name: '  CPSX dở dang', type: 'debit', parentCode: '140' },
      { code: '155', name: '  Thành phẩm', type: 'debit', parentCode: '140' },
      { code: '156', name: '  Hàng hóa', type: 'debit', parentCode: '140' },
      { code: '157', name: '  Hàng gửi đi bán', type: 'debit', parentCode: '140' },
      { code: '150', name: 'Tài sản ngắn hạn khác', type: 'debit', isTotal: true },
      { code: '242', name: '  Chi phí trả trước ngắn hạn', type: 'debit', parentCode: '150' },
      { code: '200', name: 'B. TÀI SẢN DÀI HẠN (200=210+220+230+240+250+260)', type: 'debit', isTotal: true },
      { code: '211', name: '  Tài sản cố định hữu hình', type: 'debit', parentCode: '210' },
      { code: '213', name: '  Tài sản cố định vô hình', type: 'debit', parentCode: '210' },
      { code: '214', name: '  Hao mòn tài sản cố định', type: 'contra-asset', parentCode: '210' },
      { code: '217', name: '  Bất động sản đầu tư', type: 'debit', parentCode: '220' },
      { code: '241', name: '  XDCB dở dang', type: 'debit', parentCode: '230' },
      { code: '244', name: '  Cầm cố, ký quỹ, ký cược dài hạn', type: 'debit', parentCode: '250' },
    ]
  },
  liabilities: {
    title: 'C. NỢ PHẢI TRẢ (300=310+320+330)',
    code: '3',
    accounts: [
      { code: '310', name: 'Nợ ngắn hạn', type: 'credit', isTotal: true },
      { code: '331', name: '  Phải trả người bán', type: 'hermaphroditic', parentCode: '310' },
      { code: '333', name: '  Thuế và các khoản phải nộp NN', type: 'credit', parentCode: '310' },
      { code: '334', name: '  Phải trả người lao động', type: 'credit', parentCode: '310' },
      { code: '336', name: '  Phải trả nội bộ', type: 'credit', parentCode: '310' },
      { code: '338', name: '  Phải trả, phải nộp khác', type: 'hermaphroditic', parentCode: '310' },
      { code: '341', name: '  Vay và nợ thuê tài chính', type: 'credit', parentCode: '310' },
      { code: '320', name: 'Nợ dài hạn', type: 'credit', isTotal: true },
      { code: '352', name: '  Dự phòng phải trả dài hạn', type: 'credit', parentCode: '320' },
    ]
  },
  equity: {
    title: 'D. VỐN CHỦ SỞ HỮU (400=410+420+430)',
    code: '4',
    accounts: [
      { code: '410', name: 'Vốn chủ sở hữu', type: 'credit', isTotal: true },
      { code: '411', name: '  Vốn góp của chủ sở hữu', type: 'credit', parentCode: '410' },
      { code: '412', name: '  Chênh lệch đánh giá lại tài sản', type: 'credit', parentCode: '410' },
      { code: '414', name: '  Quỹ đầu tư phát triển', type: 'credit', parentCode: '410' },
      { code: '418', name: '  Các quỹ khác thuộc VCSH', type: 'credit', parentCode: '410' },
      { code: '419', name: '  Cổ phiếu quỹ', type: 'contra-equity', parentCode: '410' },
      { code: '421', name: '  Lợi nhuận sau thuế chưa PP', type: 'credit', parentCode: '410' },
      { code: '430', name: 'Nguồn kinh phí, quỹ khác', type: 'credit', isTotal: true },
      { code: '353', name: '  Quỹ khen thưởng, phúc lợi', type: 'credit', parentCode: '430' },
    ]
  }
};

// ====================================================================
// HẰNG SỐ TÍNH CHẤT TÀI KHOẢN (ACCOUNT NATURE)
// ====================================================================
const ACCOUNT_NATURES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
  BOTH: 'BOTH'
};

// ====================================================================
// HÀM TÍNH NET BALANCE THEO ĐÚNG CHUẨN (GIỐNG backend/accountNature.js)
// ====================================================================

/**
 * Xác định tính chất tài khoản dựa trên mã số
 * Quy tắc giống backend businessRules.js
 */
function getAccountNature(accountCode) {
  if (!accountCode) return ACCOUNT_NATURES.DEBIT;
  const code = accountCode.toString().trim();

  // Ngoại lệ - tài khoản lưỡng tính
  const exceptions = {
    '131': ACCOUNT_NATURES.BOTH,
    '331': ACCOUNT_NATURES.BOTH,
    '138': ACCOUNT_NATURES.BOTH,
    '338': ACCOUNT_NATURES.BOTH,
    '214': ACCOUNT_NATURES.CREDIT,  // Đối tài - dư Có
    '229': ACCOUNT_NATURES.CREDIT,  // Đối tài - dư Có
    '419': ACCOUNT_NATURES.DEBIT,   // Đối vốn - dư Nợ
  };

  // Kiểm tra ngoại lệ (bao gồm tài khoản con)
  for (let len = code.length; len >= 3; len--) {
    const subCode = code.substring(0, len);
    if (exceptions[subCode]) return exceptions[subCode];
  }

  // Quy tắc prefix
  const rules = [
    { prefix: '1', nature: ACCOUNT_NATURES.DEBIT },
    { prefix: '2', nature: ACCOUNT_NATURES.DEBIT },
    { prefix: '3', nature: ACCOUNT_NATURES.CREDIT },
    { prefix: '4', nature: ACCOUNT_NATURES.CREDIT },
    { prefix: '5', nature: ACCOUNT_NATURES.CREDIT },
    { prefix: '6', nature: ACCOUNT_NATURES.DEBIT },
    { prefix: '7', nature: ACCOUNT_NATURES.CREDIT },
    { prefix: '8', nature: ACCOUNT_NATURES.DEBIT },
    { prefix: '9', nature: ACCOUNT_NATURES.DEBIT },
  ];

  const matched = rules.find(r => code.startsWith(r.prefix));
  return matched ? matched.nature : ACCOUNT_NATURES.DEBIT;
}

/**
 * Tính NET Balance theo đúng công thức kế toán
 * Giống hệt backend calculateNetBalance()
 */
function calculateNetBalance(debit, credit, nature) {
  const d = parseFloat(debit) || 0;
  const c = parseFloat(credit) || 0;

  switch (nature) {
    case ACCOUNT_NATURES.DEBIT: {
      const net = d - c;
      return {
        netBalance: Math.abs(net),
        balanceType: net >= 0 ? ACCOUNT_NATURES.DEBIT : ACCOUNT_NATURES.CREDIT
      };
    }
    case ACCOUNT_NATURES.CREDIT: {
      const net = c - d;
      return {
        netBalance: Math.abs(net),
        balanceType: net >= 0 ? ACCOUNT_NATURES.CREDIT : ACCOUNT_NATURES.DEBIT
      };
    }
    case ACCOUNT_NATURES.BOTH: {
      if (d >= c) {
        return { netBalance: d - c, balanceType: ACCOUNT_NATURES.DEBIT };
      } else {
        return { netBalance: c - d, balanceType: ACCOUNT_NATURES.CREDIT };
      }
    }
    default:
      return { netBalance: Math.abs(d - c), balanceType: d >= c ? ACCOUNT_NATURES.DEBIT : ACCOUNT_NATURES.CREDIT };
  }
}

// ====================================================================
// COMPONENT CHÍNH
// ====================================================================

export default function BalanceSheetB01() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());
  const [balanceData, setBalanceData] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    isBalanced: true
  });
  const [auditWarnings, setAuditWarnings] = useState([]);
  const reportRef = useRef(null);

  const companyId = activeCompany?.id || activeCompany;

  // React Query: Fetch balance sheet data
  const { data: balanceSheetData, isLoading: loadingBalance } = useQuery({
    queryKey: ['balanceSheet', companyId, fiscalYear],
    queryFn: async () => {
      if (!companyId) return null;
      
      const response = await api.get(`/report/balance-sheet?company_id=${companyId}&year=${fiscalYear}`);
      return response.data?.data || response.data || null;
    },
    enabled: Boolean(companyId),
    staleTime: 1000 * 60 * 5,
  });

  // React Query: Fetch customer balances
  const { data: customerData } = useQuery({
    queryKey: ['customerBalances', companyId, fiscalYear],
    queryFn: async () => {
      if (!companyId) return null;
      
      const response = await api.get(`/report/customer-balances?company_id=${companyId}&year=${fiscalYear}`);
      if (response.data?.success && response.data.data) {
        const customerMap = {};
        response.data.data.forEach(item => {
          const accCode = item.account_code || '131';
          if (!customerMap[accCode]) customerMap[accCode] = { debit: 0, credit: 0, details: [] };
          if (item.balance_type === 'asset') {
            customerMap[accCode].debit += parseFloat(item.amount) || 0;
          } else {
            customerMap[accCode].credit += parseFloat(item.amount) || 0;
          }
          customerMap[accCode].details.push(item);
        });
        return customerMap;
      }
      return {};
    },
    enabled: Boolean(companyId),
    staleTime: 1000 * 60 * 5,
  });

  // React Query: Fetch supplier balances
  const { data: supplierData } = useQuery({
    queryKey: ['supplierBalances', companyId, fiscalYear],
    queryFn: async () => {
      if (!companyId) return null;
      
      const response = await api.get(`/report/supplier-balances?company_id=${companyId}&year=${fiscalYear}`);
      if (response.data?.success && response.data.data) {
        const supplierMap = {};
        response.data.data.forEach(item => {
          const accCode = item.account_code || '331';
          if (!supplierMap[accCode]) supplierMap[accCode] = { debit: 0, credit: 0, details: [] };
          if (item.balance_type === 'asset') {
            supplierMap[accCode].debit += parseFloat(item.amount) || 0;
          } else {
            supplierMap[accCode].credit += parseFloat(item.amount) || 0;
          }
          supplierMap[accCode].details.push(item);
        });
        return supplierMap;
      }
      return {};
    },
    enabled: Boolean(companyId),
    staleTime: 1000 * 60 * 5,
  });

  const loading = loadingBalance;

  // Derived state from queries
  const ledger = balanceSheetData || {};
  const customerBalances = customerData || {};
  const supplierBalances = supplierData || {};

  // Build balance lookup when ledger changes
  const balanceLookup = React.useMemo(() => {
    if (!ledger) return {};
    
    const lookup = {};
    const pushGroup = (arr) => (Array.isArray(arr) ? arr : []).forEach((e) => {
      const code = e.account_code || e.accountCode;
      if (!code) return;
      lookup[code] = {
        amount: parseFloat(e.amount) || 0,
        balanceType: e.balance_type || e.balanceType || 'DEBIT',
        account_nature: e.account_nature || e.accountNature
      };
    });
    pushGroup(ledger.assets);
    pushGroup(ledger.liabilities);
    pushGroup(ledger.equity);
    return lookup;
  }, [ledger]);

  // Calculate totals and audit checks when data changes
  React.useEffect(() => {
    if (balanceLookup && Object.keys(balanceLookup).length > 0) {
      calculateTotals(balanceLookup, customerBalances, supplierBalances);
      runAuditChecks(balanceLookup);
    }
  }, [balanceLookup, customerBalances, supplierBalances]);

  // Real-time cache sync
  useRealtimeCacheSync({
    queries: [
      ['balanceSheet'],
      ['customerBalances'],
      ['supplierBalances']
    ],
    events: [
      'voucher:created',
      'voucher:updated',
      'voucher:deleted',
      'voucher:posted',
      'closing:completed',
      'closing:reopened',
      'account:updated'
    ],
    enabled: Boolean(companyId)
  });

  /**
   * Kiểm tra các bất thường kế toán (Audit Warnings)
   * - Tổ hợp 3: Tài khoản DEBIT có dư Có (ví dụ: âm quỹ)
   * - Tổ hợp 6: Tài khoản CREDIT có dư Nợ (ví dụ: trả nợ quá số phải trả)
   * - Tổ hợp 11: Khấu hao > Nguyên giá
   * Dùng balanceLookup (số dư cuối kỳ = opening + period) để kiểm tra.
   */
  const runAuditChecks = (lookup) => {
    const warnings = [];

    // Kiểm tra tài khoản DEBIT có dư Có bất thường
    Object.keys(lookup).forEach(accCode => {
      const entry = lookup[accCode];
      if (!entry) return;
      const nature = getAccountNature(accCode);
      // balanceType từ API: 'DEBIT' nếu dư Nợ, 'CREDIT' nếu dư Có
      const balanceType = entry.balanceType || (nature === ACCOUNT_NATURES.BOTH ? 'DEBIT' : nature);
      const netBalance = Math.abs(entry.amount) || 0;

      if (nature === ACCOUNT_NATURES.DEBIT && balanceType === ACCOUNT_NATURES.CREDIT && netBalance > 0) {
        warnings.push({
          type: 'warning',
          account: accCode,
          message: `TK ${accCode} (thuần Nợ) đang có số dư Có ${netBalance.toLocaleString('vi-VN')}. Kiểm tra bất thường (âm quỹ, âm kho,...)`
        });
      }
      if (nature === ACCOUNT_NATURES.CREDIT && balanceType === ACCOUNT_NATURES.DEBIT && netBalance > 0) {
        warnings.push({
          type: 'warning',
          account: accCode,
          message: `TK ${accCode} (thuần Có) đang có số dư Nợ ${netBalance.toLocaleString('vi-VN')}. Kiểm tra bất thường (trả nợ quá số phải trả)`
        });
      }
    });

    // Kiểm tra khấu hao > nguyên giá (TK 214 vs 211)
    if (lookup['211'] && lookup['214']) {
      const assetValue = lookup['211'].amount || 0;
      const depreValue = lookup['214'].amount || 0;
      if (depreValue > assetValue && assetValue > 0) {
        warnings.push({
          type: 'error',
          account: '214',
          message: `Khấu hao (${depreValue.toLocaleString('vi-VN')}) > Nguyên giá TSCĐ (${assetValue.toLocaleString('vi-VN')}). Sai lệch nghiêm trọng!`
        });
      }
    }

    setAuditWarnings(warnings);
  };

  const calculateTotals = (data, customerMap, supplierMap) => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // Tính tổng Tài sản từ các chỉ tiêu tổng hợp cấp 1
    const assetTotalCodes = ['110', '120', '130', '140', '150', '200'];
    assetTotalCodes.forEach(code => {
      const balance = getAccountBalanceForTotal(data, code, 'debit', customerMap, supplierMap);
      totalAssets += Math.abs(balance);
    });

    // Tính tổng Nợ phải trả
    const liabilityTotalCodes = ['310', '320'];
    liabilityTotalCodes.forEach(code => {
      const balance = getAccountBalanceForTotal(data, code, 'credit', customerMap, supplierMap);
      totalLiabilities += Math.abs(balance);
    });

    // Tính tổng VCSH
    const equityTotalCodes = ['410', '430'];
    equityTotalCodes.forEach(code => {
      const balance = getAccountBalanceForTotal(data, code, 'credit', customerMap, supplierMap);
      totalEquity += Math.abs(balance);
    });

    setBalanceData({
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    });
  };

  /**
   * Lấy số dư cho chỉ tiêu tổng hợp (tính tổng các tài khoản con)
   */
  const getAccountBalanceForTotal = (data, parentCode, defaultType, customerMap, supplierMap) => {
    const children = findChildren(parentCode);
    if (children.length === 0) {
      return getDirectBalance(data, parentCode, defaultType, customerMap, supplierMap);
    }

    let sum = 0;
    children.forEach(childCode => {
      sum += getDirectBalance(data, childCode, defaultType, customerMap, supplierMap);
    });
    return sum;
  };

  /**
   * Lấy số dư trực tiếp cho 1 tài khoản.
   * `data` ở đây là balanceLookup (số dư cuối kỳ = opening + period do API trả về).
   * - TK lưỡng tính (131, 331, 138, 338): bóc tách theo đối tác từ customer/supplierMap.
   * - TK đối tài (214): dùng depreciation.amount (lũy kế) từ API.
   * - TK thuế (333): dùng tax_balances từ API.
   * - TK thường: dùng amount + balance_type từ lookup.
   */
  const getDirectBalance = (data, accountCode, accountType, customerMap, supplierMap) => {
    const nature = getAccountNature(accountCode);

    // ================================================================
    // TRƯỜNG HỢP 1: Tài khoản lưỡng tính (BOTH) - 131, 331, 138, 338
    // Bóc tách theo đối tác (đã gộp opening + period theo partner)
    // ================================================================
    if (nature === ACCOUNT_NATURES.BOTH) {
      const partnerData = customerMap?.[accountCode] || supplierMap?.[accountCode];
      if (partnerData) {
        if (accountType === 'debit' || accountType === 'hermaphroditic') {
          return partnerData.debit - partnerData.credit; // Dư Nợ - Dư Có
        } else {
          return partnerData.credit - partnerData.debit; // Dư Có - Dư Nợ
        }
      }
      // FALLBACK: dùng lookup gộp
      const entry = data[accountCode];
      if (entry) {
        const net = entry.amount || 0;
        const bt = entry.balanceType || nature;
        if (accountType === 'debit' || accountType === 'hermaphroditic') {
          return bt === ACCOUNT_NATURES.DEBIT ? net : -net;
        }
        return bt === ACCOUNT_NATURES.CREDIT ? net : -net;
      }
      return 0;
    }

    // ================================================================
    // TRƯỜNG HỢP 2: Tài khoản đối tài (contra-asset) - 214, 229
    // Dùng depreciation.amount (lũy kế = opening + period) từ API
    // ================================================================
    if (accountType === 'contra-asset') {
      const dep = ledger?.depreciation;
      if (accountCode.startsWith('214') && dep) {
        return -(Math.abs(dep.amount) || 0); // luôn âm bên Tài sản
      }
      const entry = data[accountCode];
      return entry ? -(Math.abs(entry.amount) || 0) : 0;
    }

    // ================================================================
    // TRƯỜNG HỢP 3: Tài khoản đối vốn (contra-equity) - 419
    // ================================================================
    if (accountType === 'contra-equity') {
      const entry = data[accountCode];
      return entry ? -(Math.abs(entry.amount) || 0) : 0;
    }

    // ================================================================
    // TRƯỜNG HỢP 4: Tài khoản thuế (333) - dùng tax_balances (kỳ trước + phát sinh)
    // ================================================================
    if (accountCode.startsWith('333')) {
      const tb = ledger?.tax_balances;
      if (tb && typeof tb === 'object') {
        // Tổng các khoản thuế phải nộp (debit - credit đã được tính thành amount)
        let total = 0;
        Object.values(tb).forEach((t) => { total += parseFloat(t?.amount) || 0; });
        return total;
      }
    }

    // ================================================================
    // TRƯỜNG HỢP 5: Tài khoản thông thường (DEBIT / CREDIT)
    // Dùng amount + balance_type từ lookup (số dư cuối kỳ)
    // ================================================================
    const entry = data[accountCode];
    if (!entry) return 0;
    const net = entry.amount || 0;
    const bt = entry.balanceType || (nature === ACCOUNT_NATURES.BOTH ? 'DEBIT' : nature);

    if (accountType === 'debit') {
      return bt === ACCOUNT_NATURES.DEBIT ? net : -net;
    }
    return bt === ACCOUNT_NATURES.CREDIT ? net : -net;
  };

  const findChildren = (parentCode) => {
    const children = [];
    for (const group of Object.values(ACCOUNT_GROUPS)) {
      group.accounts.forEach(acc => {
        if (acc.parentCode === parentCode) {
          children.push(acc.code);
        }
      });
    }
    return children;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: getDefaultCurrency(),
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  /**
   * Lấy số dư hiển thị cho 1 chỉ tiêu
   * Trả về { debitDisplay, creditDisplay, netDisplay, isNegative }
   * - debitDisplay: số hiển thị bên Nợ (Tài sản)
   * - creditDisplay: số hiển thị bên Có (Nguồn vốn)
   * - netDisplay: số dư thuần (có thể âm)
   * - isNegative: true nếu cần hiển thị trong ngoặc (...)
   */
  const getDisplayBalances = (acc, data, customerMap, supplierMap) => {
    const balance = getDirectBalance(data, acc.code, acc.type, customerMap, supplierMap);
    const absBalance = Math.abs(balance);

    // Tài khoản đối tài/đối vốn: luôn hiển thị âm (...)
    if (acc.type === 'contra-asset' || acc.type === 'contra-equity') {
      return {
        debitDisplay: acc.type === 'contra-asset' ? 0 : 0,
        creditDisplay: acc.type === 'contra-equity' ? 0 : 0,
        netDisplay: -absBalance,
        isNegative: true,
        displayValue: absBalance
      };
    }

    // Tài khoản lưỡng tính: hiển thị bên Nợ nếu dư Nợ, bên Có nếu dư Có
    if (acc.type === 'hermaphroditic') {
      if (balance > 0) {
        return {
          debitDisplay: absBalance,
          creditDisplay: 0,
          netDisplay: absBalance,
          isNegative: false,
          displayValue: absBalance
        };
      } else if (balance < 0) {
        return {
          debitDisplay: 0,
          creditDisplay: absBalance,
          netDisplay: -absBalance,
          isNegative: false,
          displayValue: absBalance
        };
      }
      return {
        debitDisplay: 0,
        creditDisplay: 0,
        netDisplay: 0,
        isNegative: false,
        displayValue: 0
      };
    }

    // Tài khoản thông thường
    if (acc.type === 'debit') {
      return {
        debitDisplay: balance > 0 ? absBalance : 0,
        creditDisplay: balance < 0 ? absBalance : 0,
        netDisplay: balance,
        isNegative: balance < 0,
        displayValue: absBalance
      };
    } else {
      return {
        debitDisplay: balance < 0 ? absBalance : 0,
        creditDisplay: balance > 0 ? absBalance : 0,
        netDisplay: balance,
        isNegative: balance < 0,
        displayValue: absBalance
      };
    }
  };

  const handleExportExcel = () => {
    if (!reportRef.current) return;
    const table = reportRef.current.querySelector('table');
    if (!table) return;

    let csv = '\uFEFF';
    csv += 'BẢNG CÂN ĐỐI KẾ TOÁN B01-DN\n';
    csv += `Năm tài chính: ${fiscalYear}\n\n`;
    csv += 'Mã chỉ tiêu,Tên chỉ tiêu,Số cuối kỳ,Số đầu năm,Ghi chú\n';

    for (const group of Object.values(ACCOUNT_GROUPS)) {
      csv += `\n${group.title},,,\n`;
      group.accounts.forEach(acc => {
        const { displayValue, isNegative } = getDisplayBalances(acc, balanceLookup, customerBalances, supplierBalances);
        const displayStr = isNegative ? `(${displayValue.toLocaleString('vi-VN')})` : displayValue.toLocaleString('vi-VN');
        csv += `${acc.code},"${acc.name}",${displayStr},0,\n`;
      });
    }

    csv += '\n';
    csv += `Tổng Tài sản,,${balanceData.totalAssets.toLocaleString('vi-VN')},0,\n`;
    csv += `Tổng Nợ phải trả,,${balanceData.totalLiabilities.toLocaleString('vi-VN')},0,\n`;
    csv += `Tổng VCSH,,${balanceData.totalEquity.toLocaleString('vi-VN')},0,\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `B01-DN_${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Đang tính toán bảng cân đối kế toán...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
            <FileText className="text-emerald-600" size={24} />
            Bảng Cân Đối Kế Toán B01-DN
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Theo Thông tư 99/2025/TT-BTC - Ban hành ngày 15/6/2025
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
          >
            <Download size={14} />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Audit Warnings */}
      {auditWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="text-amber-600" size={18} />
            <span className="text-sm font-bold text-amber-800">Cảnh báo kiểm toán ({auditWarnings.length})</span>
          </div>
          <div className="space-y-1">
            {auditWarnings.map((w, i) => (
              <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${
                w.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <span className="font-bold">[{w.account}]</span> {w.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bảng cân đối */}
      <div ref={reportRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="p-3 w-24">Mã chỉ tiêu</th>
                <th className="p-3">Tên chỉ tiêu</th>
                <th className="p-3 w-36 text-right">Số cuối kỳ</th>
                <th className="p-3 w-36 text-right">Số đầu năm</th>
                <th className="p-3 w-40 text-right">Số dư thuần (NET)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(ACCOUNT_GROUPS).map((group, gi) => (
                <React.Fragment key={gi}>
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2 text-slate-700" colSpan="5">{group.title}</td>
                  </tr>
                  {group.accounts.map((acc, ai) => {
                    const { displayValue, isNegative, netDisplay } = getDisplayBalances(acc, balanceLookup, customerBalances, supplierBalances);
                    const isTotal = acc.isTotal;

                    if (displayValue === 0 && !isTotal) return null;

                    // Xác định class hiển thị
                    const valueClass = isNegative
                      ? 'text-red-600'
                      : (isTotal ? 'text-indigo-700' : 'text-emerald-700');

                    // Format số âm: (1.000.000) thay vì -1.000.000
                    const formattedValue = isNegative
                      ? `(${displayValue.toLocaleString('vi-VN')})`
                      : (displayValue > 0 ? displayValue.toLocaleString('vi-VN') : '—');

                    return (
                      <tr key={ai} className={`hover:bg-slate-50/30 transition ${isTotal ? 'font-bold bg-slate-50/50' : ''}`}>
                        <td className={`p-3 font-mono ${isTotal ? 'text-indigo-700' : 'text-blue-600'}`}>
                          {acc.code}
                        </td>
                        <td className={`p-3 text-slate-600 ${isTotal ? 'font-bold' : ''}`}>
                          {acc.name}
                          {isNegative && (
                            <span className="ml-1 text-red-500 font-bold">(*)</span>
                          )}
                        </td>
                        <td className={`p-3 text-right font-mono font-bold ${valueClass}`}>
                          {formattedValue}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">—</td>
                        <td className={`p-3 text-right font-mono font-bold ${valueClass}`}>
                          {netDisplay !== 0 ? (
                            <span>
                              {netDisplay.toLocaleString('vi-VN')}
                              <span className="ml-1 text-xs">
                                {netDisplay > 0 ? 'DR' : 'CR'}
                              </span>
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tổng hợp */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Tổng Tài sản (A+B):</span>
              <span className="ml-2 font-black text-emerald-700">{formatCurrency(balanceData.totalAssets)}</span>
            </div>
            <div>
              <span className="text-slate-500">Tổng Nợ phải trả (C):</span>
              <span className="ml-2 font-black text-amber-700">{formatCurrency(balanceData.totalLiabilities)}</span>
            </div>
            <div>
              <span className="text-slate-500">Tổng VCSH (D):</span>
              <span className="ml-2 font-black text-purple-700">{formatCurrency(balanceData.totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kiểm tra cân đối */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        balanceData.isBalanced 
          ? 'bg-emerald-50 border-emerald-200' 
          : 'bg-rose-50 border-rose-200'
      }`}>
        <div className="flex items-center gap-2">
          {balanceData.isBalanced ? (
            <CheckCircle2 className="text-emerald-600" size={20} />
          ) : (
            <AlertCircle className="text-rose-600" size={20} />
          )}
          <span className={`text-sm font-bold ${
            balanceData.isBalanced ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {balanceData.isBalanced 
              ? '✓ Bảng cân đối kế toán cân đối - Tài sản = Nợ phải trả + VCSH' 
              : `✗ Lệch sổ sách: ${formatCurrency(Math.abs(balanceData.totalAssets - (balanceData.totalLiabilities + balanceData.totalEquity)))}`
            }
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Công thức kế toán</div>
          <div className="text-sm font-black">
            {formatCurrency(balanceData.totalAssets)} = {formatCurrency(balanceData.totalLiabilities + balanceData.totalEquity)}
          </div>
        </div>
      </div>
    </div>
  );
}