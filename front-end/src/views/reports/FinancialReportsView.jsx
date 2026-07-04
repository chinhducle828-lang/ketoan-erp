import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { FileSpreadsheet, BarChart3, FileText, RefreshCw, Download } from 'lucide-react';

export default function FinancialReportsView() {
  const { activeCompany, fiscalYear } = useAuth();
  const [cashFlowData, setCashFlowData] = useState(null);
  const [financialNotes, setFinancialNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('indirect'); // direct hoặc indirect

  const companyId = activeCompany?.id || activeCompany;

  useEffect(() => {
    if (companyId) {
      fetchReports();
    }
  }, [companyId, fiscalYear, method]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Lấy dữ liệu báo cáo lưu chuyển tiền tệ
      const cashFlowRes = await api.get('/report/cash-flow', {
        params: { company_id: companyId, year: fiscalYear, method }
      });
      setCashFlowData(cashFlowRes.data?.data);

      // Lấy dữ liệu bản thuyết minh BCTC
      const notesRes = await api.get('/report/financial-notes', {
        params: { company_id: companyId, year: fiscalYear }
      });
      setFinancialNotes(notesRes.data?.data);
    } catch (error) {
      console.error('Lỗi tải báo cáo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch(`/api/report/export/cash-flow-excel?company_id=${companyId}&year=${fiscalYear}&method=${method}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Lỗi xuất Excel');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `B03-DN_${companyId}_${fiscalYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Lỗi xuất file Excel');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value || 0);
  };

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase">
          <BarChart3 className="text-emerald-600" size={24} />
          Báo Cáo Lưu Chuyển Tiền Tệ & Thuyết Minh BCTC
        </h1>
        <p className="text-xs text-slate-500 mt-1">B03-DN (Lưu chuyển tiền tệ) & B09-DN (Bản thuyết minh)</p>
      </div>

      {/* Chọn phương pháp */}
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

      {/* Báo cáo lưu chuyển tiền tệ B03-DN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            Báo Cáo Lưu Chuyển Tiền Tệ (B03-DN)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500">Đang tải dữ liệu...</p>
          </div>
        ) : cashFlowData ? (
          <div className="p-4">
            {method === 'direct' ? (
              // Phương pháp trực tiếp
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700">I. HOẠT ĐỘNG SẢN XUẤT KINH DOANH</h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">Tiền thu từ bán hàng</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.operatingActivities?.cashReceivedFromCustomers)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Tiền chi trả cho người bán</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.operatingActivities?.cashPaidToSuppliers)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Tiền chi trả cho nhân viên</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.operatingActivities?.cashPaidToEmployees)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              // Phương pháp gián tiếp
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700">PHƯƠNG PHÁP GIÁN TIẾP</h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="p-2 font-bold">Lợi nhuận trước thuế</td>
                      <td className="p-2 text-right font-mono font-bold">{formatCurrency(cashFlowData.profitBeforeTax)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4">+ Khấu hao TSCĐ</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.adjustments?.depreciation)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4">+ Dự phòng</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.adjustments?.provisions)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-4">- Biến động vốn lưu động:</td>
                      <td className="p-2 text-right font-mono"></td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-8">Phải thu khách hàng</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.adjustments?.workingCapitalChanges?.accountsReceivable)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-8">Hàng tồn kho</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.adjustments?.workingCapitalChanges?.inventory)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 pl-8">Phải trả NCC</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(cashFlowData.adjustments?.workingCapitalChanges?.accountsPayable)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Chưa có dữ liệu báo cáo lưu chuyển tiền tệ
          </div>
        )}
      </div>

      {/* Bản thuyết minh BCTC B09-DN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            Bản Thuyết Minh Báo Cáo Tài Chính (B09-DN)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500">Đang tải dữ liệu...</p>
          </div>
        ) : financialNotes ? (
          <div className="p-4 space-y-6">
            {/* Thông tin doanh nghiệp */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">I. Thông tin doanh nghiệp</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Tên công ty:</span>
                  <span className="ml-2 font-medium">{financialNotes.companyInfo?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mã số thuế:</span>
                  <span className="ml-2 font-medium">{financialNotes.companyInfo?.taxCode || 'N/A'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Địa chỉ:</span>
                  <span className="ml-2 font-medium">{financialNotes.companyInfo?.address || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Chính sách kế toán */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">II. Chính sách kế toán</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Going concern:</span>
                  <span className="ml-2 font-medium">{financialNotes.accountingPolicies?.goingConcern ? 'Áp dụng' : 'Không áp dụng'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Phương pháp giá vốn:</span>
                  <span className="ml-2 font-medium">{financialNotes.accountingPolicies?.inventoryMethod === 'weighted_average' ? 'Bình quân gia quyền' : 'Khác'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Khấu hao TSCĐ:</span>
                  <span className="ml-2 font-medium">{financialNotes.accountingPolicies?.depreciationMethod === 'straight_line' ? 'Phương pháp trực tiếp' : 'Khác'}</span>
                </div>
              </div>
            </div>

            {/* Chi tiết số liệu */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">III. Chi tiết số liệu</h3>
              
              {/* Bảng tiền */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-600 mb-1">1. Bảng tiền (TK 111, 112)</h4>
                <table className="w-full text-xs border border-slate-100 rounded-lg">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">Tiền mặt (111)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.cashBalances?.cash?.balance)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Tiền gửi ngân hàng (112)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.cashBalances?.bank?.balance)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2">Tổng</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.cashBalances?.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TSCĐ & Tài sản sinh học */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-600 mb-1">2. Biến động TSCĐ & tài sản sinh học (TK 211, 215)</h4>
                <table className="w-full text-xs border border-slate-100 rounded-lg">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">Tài sản cố định (211)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.fixedAssetChanges?.fixedAssets?.balance)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Tài sản sinh học (215)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.fixedAssetChanges?.biologicalAssets?.balance)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Hao mòn TSCĐ (214)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.fixedAssetChanges?.accumulatedDepreciation?.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Chi tiết thuế */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 mb-1">3. Chi tiết thuế (TK 333)</h4>
                <table className="w-full text-xs border border-slate-100 rounded-lg">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">Thuế GTGT (33311)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.taxDetails?.vat?.amount)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Thuế TNDN (3334) - Tối thiểu 15%</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.taxDetails?.corporateTax?.amount)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">Thuế TNCN (3335)</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.taxDetails?.incomeTax?.amount)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="p-2">Tổng thuế phải nộp</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(financialNotes.taxDetails?.totalTaxPayable)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Chưa có dữ liệu bản thuyết minh BCTC
          </div>
        )}
      </div>
    </div>
  );
}

// END_OF_FILE