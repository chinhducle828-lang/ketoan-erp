/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { FileSpreadsheet, BarChart3, FileText, RefreshCw, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';

export default function FinancialReportsView() {
  const { activeCompany, fiscalYear: contextFiscalYear } = useAuth();
  const [cashFlowData, setCashFlowData] = useState(null);
  const [financialNotes, setFinancialNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cash-flow');
  const [method, setMethod] = useState('indirect');
  const [fiscalYear, setFiscalYear] = useState(contextFiscalYear || new Date().getFullYear());

  const companyId = activeCompany?.id || activeCompany;

  useEffect(() => {
    if (companyId) {
      fetchReports();
    }
  }, [companyId, fetchReports]);

  const fetchReports = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [cashFlowRes, notesRes] = await Promise.all([
        api.get('/report/cash-flow', {
          params: { company_id: companyId, year: fiscalYear, method }
        }),
        api.get('/report/financial-notes', {
          params: { company_id: companyId, year: fiscalYear }
        })
      ]);
      setCashFlowData(cashFlowRes.data?.data);
      setFinancialNotes(notesRes.data?.data);
    } catch (error) {
      console.error('Lỗi tải báo cáo:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, fiscalYear, method]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { reports: fetchReports },
    {
      eventMap: {
        'voucher:created': ['reports'],
        'voucher:updated': ['reports'],
        'voucher:deleted': ['reports'],
        voucherCreated: ['reports'],
        voucherUpdated: ['reports'],
        voucherDeleted: ['reports'],
        'closing:completed': ['reports'],
        closingCompleted: ['reports']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(companyId) });

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/report/export/cash-flow-excel', {
        params: {
          company_id: companyId,
          year: fiscalYear,
          method
        },
        responseType: 'blob'
      });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `B03-DN_${fiscalYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Lỗi xuất file Excel');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: getDefaultCurrency(),
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const renderCashFlowDirect = () => {
    if (!cashFlowData?.operatingActivities) return null;
    const op = cashFlowData.operatingActivities;
    const inv = cashFlowData.investingActivities || {};
    const fin = cashFlowData.financingActivities || {};

    const operatingNet = (op.cashReceivedFromCustomers || 0) - (op.cashPaidToSuppliers || 0) - (op.cashPaidToEmployees || 0) - (op.interestPaid || 0) - (op.incomeTaxPaid || 0);
    const investingNet = (inv.proceedsFromDisposal || 0) - (inv.purchaseOfFixedAssets || 0);
    const financingNet = (fin.proceedsFromBorrowings || 0) - (fin.repaymentOfBorrowings || 0) - (fin.dividendsPaid || 0);
    const netChange = operatingNet + investingNet + financingNet;

    return (
      <div className="space-y-4">
        {/* I. Hoạt động SXKD */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100">
            <h3 className="text-sm font-bold text-emerald-800">I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG SẢN XUẤT KINH DOANH</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền thu từ bán hàng, cung cấp dịch vụ</td>
                <td className="p-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(op.cashReceivedFromCustomers)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền chi trả cho người cung cấp hàng hóa, dịch vụ</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.cashPaidToSuppliers)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền chi trả cho người lao động</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.cashPaidToEmployees)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền lãi vay đã trả</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.interestPaid)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Thuế TNDN đã nộp</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.incomeTaxPaid)})</td>
              </tr>
              <tr className="bg-emerald-50/50 font-bold">
                <td className="p-2 pl-4 text-emerald-800">Lưu chuyển tiền thuần từ HĐ SXKD</td>
                <td className={`p-2 text-right font-mono ${operatingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(operatingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* II. Hoạt động đầu tư */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
            <h3 className="text-sm font-bold text-blue-800">II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền chi mua sắm TSCĐ</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(inv.purchaseOfFixedAssets)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền thu từ thanh lý, nhượng bán TSCĐ</td>
                <td className="p-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(inv.proceedsFromDisposal)}</td>
              </tr>
              <tr className="bg-blue-50/50 font-bold">
                <td className="p-2 pl-4 text-blue-800">Lưu chuyển tiền thuần từ HĐ Đầu tư</td>
                <td className={`p-2 text-right font-mono ${investingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(investingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* III. Hoạt động tài chính */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-4 py-2 border-b border-purple-100">
            <h3 className="text-sm font-bold text-purple-800">III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền thu từ đi vay</td>
                <td className="p-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(fin.proceedsFromBorrowings)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền trả nợ gốc vay</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(fin.repaymentOfBorrowings)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Cổ tức, lợi nhuận đã trả</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(fin.dividendsPaid)})</td>
              </tr>
              <tr className="bg-purple-50/50 font-bold">
                <td className="p-2 pl-4 text-purple-800">Lưu chuyển tiền thuần từ HĐ Tài chính</td>
                <td className={`p-2 text-right font-mono ${financingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(financingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tổng hợp */}
        <div className="bg-slate-900 text-white p-4 rounded-xl">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Lưu chuyển tiền thuần trong kỳ</span>
              <span className={`font-bold ${netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(netChange)}
              </span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/10 pt-2">
              <span>Tiền và tương đương tiền đầu kỳ</span>
              <span className="font-bold">{formatCurrency(cashFlowData.openingCash)}</span>
            </div>
            <div className="flex justify-between text-sm font-black border-t border-white/20 pt-2">
              <span>Tiền và tương đương tiền cuối kỳ</span>
              <span className="text-emerald-400">{formatCurrency(cashFlowData.closingCash)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCashFlowIndirect = () => {
    if (!cashFlowData) return null;
    const op = cashFlowData.operatingActivities || {};
    const inv = cashFlowData.investingActivities || {};
    const fin = cashFlowData.financingActivities || {};
    const adj = cashFlowData.adjustments || {};
    const wc = adj.workingCapitalChanges || {};

    const operatingNet = (cashFlowData.profitBeforeTax || 0) + (adj.depreciation || 0) + (adj.provisions || 0) + (wc.accountsReceivable || 0) + (wc.inventory || 0) + (wc.accountsPayable || 0) - (op.interestPaid || 0) - (op.incomeTaxPaid || 0);
    const investingNet = (inv.proceedsFromDisposal || 0) - (inv.purchaseOfFixedAssets || 0);
    const financingNet = (fin.proceedsFromBorrowings || 0) - (fin.repaymentOfBorrowings || 0) - (fin.dividendsPaid || 0);
    const netChange = operatingNet + investingNet + financingNet;

    return (
      <div className="space-y-4">
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100">
            <h3 className="text-sm font-bold text-emerald-800">I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG SẢN XUẤT KINH DOANH</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50 font-bold">
                <td className="p-2 pl-4">Lợi nhuận trước thuế</td>
                <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.profitBeforeTax)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">+ Khấu hao TSCĐ</td>
                <td className="p-2 text-right font-mono text-emerald-600">+{formatCurrency(adj.depreciation)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">+ Dự phòng</td>
                <td className="p-2 text-right font-mono text-emerald-600">+{formatCurrency(adj.provisions)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">+/- Biến động phải thu KH</td>
                <td className={`p-2 text-right font-mono ${(wc.accountsReceivable || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(wc.accountsReceivable)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">+/- Biến động hàng tồn kho</td>
                <td className={`p-2 text-right font-mono ${(wc.inventory || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(wc.inventory)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">+/- Biến động phải trả NCC</td>
                <td className={`p-2 text-right font-mono ${(wc.accountsPayable || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(wc.accountsPayable)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">- Lãi vay đã trả</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.interestPaid)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-8">- Thuế TNDN đã nộp</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(op.incomeTaxPaid)})</td>
              </tr>
              <tr className="bg-emerald-50/50 font-bold">
                <td className="p-2 pl-4 text-emerald-800">Lưu chuyển tiền thuần từ HĐ SXKD</td>
                <td className={`p-2 text-right font-mono ${operatingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(operatingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* II. Hoạt động đầu tư */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
            <h3 className="text-sm font-bold text-blue-800">II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền chi mua sắm TSCĐ</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(inv.purchaseOfFixedAssets)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền thu từ thanh lý TSCĐ</td>
                <td className="p-2 text-right font-mono text-emerald-600">{formatCurrency(inv.proceedsFromDisposal)}</td>
              </tr>
              <tr className="bg-blue-50/50 font-bold">
                <td className="p-2 pl-4 text-blue-800">Lưu chuyển tiền thuần từ HĐ Đầu tư</td>
                <td className={`p-2 text-right font-mono ${investingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(investingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* III. Hoạt động tài chính */}
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="bg-purple-50 px-4 py-2 border-b border-purple-100">
            <h3 className="text-sm font-bold text-purple-800">III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền thu từ đi vay</td>
                <td className="p-2 text-right font-mono text-emerald-600">{formatCurrency(fin.proceedsFromBorrowings)}</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Tiền trả nợ gốc vay</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(fin.repaymentOfBorrowings)})</td>
              </tr>
              <tr className="hover:bg-slate-50/30">
                <td className="p-2 pl-4">Cổ tức đã trả</td>
                <td className="p-2 text-right font-mono text-rose-600">({formatCurrency(fin.dividendsPaid)})</td>
              </tr>
              <tr className="bg-purple-50/50 font-bold">
                <td className="p-2 pl-4 text-purple-800">Lưu chuyển tiền thuần từ HĐ Tài chính</td>
                <td className={`p-2 text-right font-mono ${financingNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(financingNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tổng hợp */}
        <div className="bg-slate-900 text-white p-4 rounded-xl">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Lưu chuyển tiền thuần trong kỳ</span>
              <span className={`font-bold ${netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(netChange)}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/10 pt-2">
              <span>Tiền đầu kỳ</span>
              <span className="font-bold">{formatCurrency(cashFlowData.openingCash)}</span>
            </div>
            <div className="flex justify-between text-sm font-black border-t border-white/20 pt-2">
              <span>Tiền cuối kỳ</span>
              <span className="text-emerald-400">{formatCurrency(cashFlowData.closingCash)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialNotes = () => {
    if (!financialNotes) return null;
    const ci = financialNotes.companyInfo || {};
    const ap = financialNotes.accountingPolicies || {};
    const cb = financialNotes.cashBalances || {};
    const fa = financialNotes.fixedAssetChanges || {};
    const td = financialNotes.taxDetails || {};

    return (
      <div className="space-y-6">
        {/* I. Thông tin doanh nghiệp */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">I. THÔNG TIN DOANH NGHIỆP</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-500">Tên công ty:</span><span className="ml-2 font-bold">{ci.name || 'N/A'}</span></div>
            <div><span className="text-slate-500">Mã số thuế:</span><span className="ml-2 font-bold">{ci.taxCode || 'N/A'}</span></div>
            <div className="col-span-2"><span className="text-slate-500">Địa chỉ:</span><span className="ml-2">{ci.address || 'N/A'}</span></div>
            <div><span className="text-slate-500">Ngành nghề:</span><span className="ml-2">{ci.industry || 'N/A'}</span></div>
            <div><span className="text-slate-500">Vốn điều lệ:</span><span className="ml-2 font-bold">{formatCurrency(ci.charterCapital)}</span></div>
          </div>
        </div>

        {/* II. Chính sách kế toán */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">II. CHÍNH SÁCH KẾ TOÁN ÁP DỤNG</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-500">Niên độ kế toán:</span><span className="ml-2 font-bold">Năm {fiscalYear}</span></div>
            <div><span className="text-slate-500">Đơn vị tiền tệ:</span><span className="ml-2 font-bold">Việt Nam Đồng (VND)</span></div>
            <div><span className="text-slate-500">Going concern:</span><span className="ml-2 font-bold">{ap.goingConcern ? 'Áp dụng' : 'Không áp dụng'}</span></div>
            <div><span className="text-slate-500">Phương pháp giá vốn:</span><span className="ml-2 font-bold">{ap.inventoryMethod === 'weighted_average' ? 'Bình quân gia quyền' : ap.inventoryMethod || 'N/A'}</span></div>
            <div><span className="text-slate-500">Phương pháp khấu hao:</span><span className="ml-2 font-bold">{ap.depreciationMethod === 'straight_line' ? 'Đường thẳng' : ap.depreciationMethod || 'N/A'}</span></div>
            <div><span className="text-slate-500">Phương pháp tính thuế:</span><span className="ml-2 font-bold">{ap.taxMethod === 'deduction' ? 'Khấu trừ' : 'Trực tiếp'}</span></div>
          </div>
        </div>

        {/* III. Chi tiết số liệu */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">III. CHI TIẾT SỐ LIỆU</h3>
          
          <div className="space-y-4">
            {/* Bảng tiền */}
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-2">1. Tiền và tương đương tiền (TK 111, 112)</h4>
              <table className="w-full text-xs border border-slate-100 rounded-lg">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="p-2">Tiền mặt (111)</td><td className="p-2 text-right font-mono">{formatCurrency(cb.cash?.balance)}</td></tr>
                  <tr><td className="p-2">Tiền gửi ngân hàng (112)</td><td className="p-2 text-right font-mono">{formatCurrency(cb.bank?.balance)}</td></tr>
                  <tr className="bg-slate-50 font-bold"><td className="p-2">Tổng cộng</td><td className="p-2 text-right font-mono">{formatCurrency(cb.total)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* TSCĐ */}
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-2">2. Biến động TSCĐ (TK 211, 213, 214)</h4>
              <table className="w-full text-xs border border-slate-100 rounded-lg">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="p-2">TSCĐ hữu hình (211)</td><td className="p-2 text-right font-mono">{formatCurrency(fa.fixedAssets?.balance)}</td></tr>
                  <tr><td className="p-2">TSCĐ vô hình (213)</td><td className="p-2 text-right font-mono">{formatCurrency(fa.intangibleAssets?.balance)}</td></tr>
                  <tr><td className="p-2">Hao mòn TSCĐ (214)</td><td className="p-2 text-right font-mono text-rose-600">({formatCurrency(fa.accumulatedDepreciation?.amount)})</td></tr>
                  <tr className="bg-slate-50 font-bold"><td className="p-2">Giá trị còn lại</td><td className="p-2 text-right font-mono">{formatCurrency(fa.netBookValue)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Chi tiết thuế */}
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-2">3. Chi tiết thuế (TK 333)</h4>
              <table className="w-full text-xs border border-slate-100 rounded-lg">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="p-2">Thuế GTGT đầu ra (33311)</td><td className="p-2 text-right font-mono">{formatCurrency(td.vat?.amount)}</td></tr>
                  <tr><td className="p-2">Thuế TNDN (3334)</td><td className="p-2 text-right font-mono">{formatCurrency(td.corporateTax?.amount)}</td></tr>
                  <tr><td className="p-2">Thuế TNCN (3335)</td><td className="p-2 text-right font-mono">{formatCurrency(td.incomeTax?.amount)}</td></tr>
                  <tr className="bg-slate-50 font-bold"><td className="p-2">Tổng thuế phải nộp</td><td className="p-2 text-right font-mono">{formatCurrency(td.totalTaxPayable)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
            <BarChart3 className="text-emerald-600" size={24} />
            Báo Cáo Lưu Chuyển Tiền Tệ & Thuyết Minh BCTC
          </h1>
          <p className="text-xs text-slate-500 mt-1">B03-DN (Lưu chuyển tiền tệ) & B09-DN (Bản thuyết minh)</p>
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
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
          >
            <Download size={14} />
            Xuất Excel B03-DN
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('cash-flow')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'cash-flow' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={14} />
          B03-DN LCTT
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'notes' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText size={14} />
          B09-DN Thuyết minh
        </button>
      </div>

      {/* Chọn phương pháp cho B03 */}
      {activeTab === 'cash-flow' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <label className="text-xs font-bold text-slate-600 uppercase">Phương pháp tính:</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="indirect">Gián tiếp (Indirect)</option>
              <option value="direct">Trực tiếp (Direct)</option>
            </select>
          </div>
        </div>
      )}

      {/* Nội dung */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500">Đang tải dữ liệu...</p>
        </div>
      ) : activeTab === 'cash-flow' ? (
        cashFlowData ? (
          method === 'direct' ? renderCashFlowDirect() : renderCashFlowIndirect()
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            <BarChart3 size={40} className="mx-auto mb-2 opacity-30" />
            Chưa có dữ liệu báo cáo lưu chuyển tiền tệ
          </div>
        )
      ) : (
        financialNotes ? renderFinancialNotes() : (
          <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            <FileText size={40} className="mx-auto mb-2 opacity-30" />
            Chưa có dữ liệu bản thuyết minh BCTC
          </div>
        )
      )}
    </div>
  );
}