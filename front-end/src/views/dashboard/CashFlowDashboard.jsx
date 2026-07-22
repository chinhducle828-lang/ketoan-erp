/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVoucherQueries } from '../../hooks/useVoucherQueries.js';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { getDefaultCurrency } from '../../utils/accountingRules.js';

const cashAccountPrefixes = ['111', '112'];

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: getDefaultCurrency(),
  minimumFractionDigits: 0,
}).format(Number(value || 0));

const getVoucherDate = (voucher) => voucher?.voucherDate || voucher?.date || voucher?.voucher_date || voucher?.createdAt || voucher?.created_at || '';
const getVoucherType = (voucher) => voucher?.voucherType || voucher?.type || voucher?.voucher_type || 'PKT';

const rowItems = (items, labels) => Object.entries(labels)
  .map(([key, label]) => ({ key, label, value: Number(items?.[key] || 0) }))
  .filter((item) => item.value !== 0);

function MetricCard({ icon: Icon, title, value, subtitle, tone = 'emerald' }) {
  const palette = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-200 text-emerald-700',
    rose: 'from-rose-500/15 to-rose-500/5 border-rose-200 text-rose-700',
    indigo: 'from-indigo-500/15 to-indigo-500/5 border-indigo-200 text-indigo-700',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-200 text-amber-700',
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${palette[tone] || palette.emerald}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{value}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className={`rounded-2xl border bg-white/80 p-3 shadow-sm ${tone === 'rose' ? 'text-rose-600' : tone === 'indigo' ? 'text-indigo-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, accent, children, note }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={`border-b px-5 py-4 ${accent || 'bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-800">{title}</h3>
            {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function CashFlowDashboard() {
  const { vouchers } = useVoucherQueries();
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const currentYear = new Date().getFullYear();
  const [method, setMethod] = useState('indirect');

  const { data: cashFlowData, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['cash-flow-dashboard', companyId, currentYear, method],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await api.get('/report/cash-flow', {
        params: { company_id: companyId, year: currentYear, method },
      });
      return res.data?.data || null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const cashVoucherHistory = useMemo(() => {
    const history = [];
    let inflow = 0;
    let outflow = 0;

    (Array.isArray(vouchers) ? vouchers : []).forEach((voucher) => {
      const details = Array.isArray(voucher?.details) ? voucher.details : [];
      const cashLines = details.filter((detail) => cashAccountPrefixes.some((prefix) => String(detail?.accountCode || '').startsWith(prefix)));

      if (cashLines.length === 0) {
        return;
      }

      let voucherIn = 0;
      let voucherOut = 0;

      cashLines.forEach((detail) => {
        const amount = Number(detail?.amount || 0);
        if (detail?.entryType === 'DR') {
          voucherIn += amount;
          inflow += amount;
        } else if (detail?.entryType === 'CR') {
          voucherOut += amount;
          outflow += amount;
        }
      });

      history.push({
        id: voucher?.id,
        voucherNumber: voucher?.voucherNumber || voucher?.voucher_number || voucher?.code || `#${voucher?.id || ''}`,
        description: voucher?.description || voucher?.desc || 'Chứng từ tiền mặt',
        voucherDate: getVoucherDate(voucher),
        type: getVoucherType(voucher),
        net: voucherIn - voucherOut,
        inflow: voucherIn,
        outflow: voucherOut,
      });
    });

    return {
      inflow,
      outflow,
      history: history.slice(0, 10),
    };
  }, [vouchers]);

  const report = cashFlowData || {};
  const operating = report.operatingActivities || {};
  const investing = report.investingActivities || {};
  const financing = report.financingActivities || {};
  const adjustments = report.adjustments || {};
  const workingCapital = adjustments.workingCapitalChanges || {};

  const directOperatingNet = (operating.cashReceivedFromCustomers || 0)
    - (operating.cashPaidToSuppliers || 0)
    - (operating.cashPaidToEmployees || 0)
    - (operating.interestPaid || 0)
    - (operating.incomeTaxPaid || 0);

  const investingNet = (investing.proceedsFromDisposal || 0) - (investing.purchaseOfFixedAssets || 0);
  const financingNet = (financing.proceedsFromBorrowings || 0) - (financing.repaymentOfBorrowings || 0) - (financing.dividendsPaid || 0);

  const openingCash = Number(report.openingCash || 0);
  const closingCash = Number(report.closingCash || 0);
  const netCashChange = Number(report.netCashChange || (closingCash - openingCash));

  const summaryInflow = Number(report.totalInflows || cashVoucherHistory.inflow || 0);
  const summaryOutflow = Number(report.totalOutflows || cashVoucherHistory.outflow || 0);

  const companyLabel = activeCompany?.name || `Doanh nghiệp #${companyId || '---'}`;

  if (!companyId) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center p-6">
        <div className="w-full rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <DollarSign className="mx-auto text-emerald-500" size={32} />
          <h1 className="mt-4 text-2xl font-black text-slate-900">Tổng quan dòng tiền</h1>
          <p className="mt-2 text-sm text-slate-500">Chọn doanh nghiệp để xem báo cáo lưu chuyển tiền tệ B03-DN.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-2xl shadow-slate-900/20">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              <Activity size={14} /> Cash flow dashboard
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tổng quan dòng tiền</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Theo dõi dòng tiền thực nhận, thực chi và trạng thái B03-DN của {companyLabel} trong năm {currentYear}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1">
                <CalendarDays size={12} /> Năm {currentYear}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1">
                <Clock3 size={12} /> {method === 'direct' ? 'Phương pháp trực tiếp' : 'Phương pháp gián tiếp'}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Điều khiển báo cáo</p>
                <h2 className="mt-1 text-lg font-black">Chế độ hiển thị</h2>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                <RefreshCw size={14} /> Làm mới
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/40 p-1.5">
              <button
                type="button"
                onClick={() => setMethod('indirect')}
                className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${method === 'indirect' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-300 hover:bg-white/5'}`}
              >
                Gián tiếp
              </button>
              <button
                type="button"
                onClick={() => setMethod('direct')}
                className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${method === 'direct' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-300 hover:bg-white/5'}`}
              >
                Trực tiếp
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ChevronRight size={14} />
                <span>Dữ liệu lấy từ backend report cache và tự đồng bộ theo chứng từ đã ghi sổ.</span>
              </div>
              {loading && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                  <Loader2 size={14} className="animate-spin" /> Đang tải báo cáo dòng tiền...
                </div>
              )}
              {error && (
                <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  Không thể tải báo cáo từ backend. Đang hiển thị số liệu dự phòng từ chứng từ.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ArrowUpRight}
          title="Dòng tiền vào"
          value={formatCurrency(summaryInflow)}
          subtitle="Tổng tiền thu và dòng vào quy đổi"
          tone="emerald"
        />
        <MetricCard
          icon={ArrowDownRight}
          title="Dòng tiền ra"
          value={formatCurrency(summaryOutflow)}
          subtitle="Tổng tiền chi và dòng ra quy đổi"
          tone="rose"
        />
        <MetricCard
          icon={TrendingUp}
          title="Biến động thuần"
          value={formatCurrency(netCashChange)}
          subtitle={netCashChange >= 0 ? 'Dòng tiền đang dương' : 'Dòng tiền đang âm'}
          tone={netCashChange >= 0 ? 'indigo' : 'amber'}
        />
        <MetricCard
          icon={DollarSign}
          title="Tiền cuối kỳ"
          value={formatCurrency(closingCash || cashVoucherHistory.inflow - cashVoucherHistory.outflow)}
          subtitle={`Tiền đầu kỳ: ${formatCurrency(openingCash)}`}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="I. Hoạt động kinh doanh"
          accent="bg-emerald-50"
          note={method === 'direct' ? 'Dòng tiền trực tiếp từ bán hàng và thanh toán.' : 'Gián tiếp từ lợi nhuận trước thuế và điều chỉnh.'}
        >
          <div className="space-y-2 text-sm">
            {method === 'direct' ? (
              rowItems(operating, {
                cashReceivedFromCustomers: 'Tiền thu từ khách hàng',
                cashPaidToSuppliers: 'Tiền chi trả cho nhà cung cấp',
                cashPaidToEmployees: 'Tiền chi trả cho nhân viên',
                interestPaid: 'Tiền lãi vay đã trả',
                incomeTaxPaid: 'Thuế TNDN đã nộp',
              }).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">{item.label}</span>
                  <span className={`font-mono font-bold ${item.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Lợi nhuận trước thuế</span>
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(report.profitBeforeTax)}</span>
                </div>
                {rowItems(adjustments, {
                  depreciation: 'Khấu hao',
                  provisions: 'Dự phòng',
                }).map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
                {rowItems(workingCapital, {
                  accountsReceivable: 'Biến động phải thu',
                  inventory: 'Biến động hàng tồn kho',
                  accountsPayable: 'Biến động phải trả',
                }).map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-emerald-800">Dòng tiền thuần</span>
                <span className="font-mono font-black text-emerald-700">{formatCurrency(method === 'direct' ? directOperatingNet : (report.operatingNet || 0))}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="II. Hoạt động đầu tư" accent="bg-sky-50" note="Biến động tài sản và đầu tư dài hạn.">
          <div className="space-y-2 text-sm">
            {rowItems(investing, {
              purchaseOfFixedAssets: 'Mua sắm TSCĐ',
              proceedsFromDisposal: 'Thanh lý, nhượng bán TSCĐ',
            }).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">{item.label}</span>
                <span className={`font-mono font-bold ${item.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-sky-800">Dòng tiền thuần</span>
                <span className={`font-mono font-black ${investingNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(investingNet)}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="III. Hoạt động tài chính" accent="bg-violet-50" note="Nguồn vốn vay và hoàn trả cổ tức/khoản vay.">
          <div className="space-y-2 text-sm">
            {rowItems(financing, {
              proceedsFromBorrowings: 'Thu từ đi vay',
              repaymentOfBorrowings: 'Trả nợ vay',
              dividendsPaid: 'Cổ tức đã trả',
            }).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">{item.label}</span>
                <span className={`font-mono font-bold ${item.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-violet-800">Dòng tiền thuần</span>
                <span className={`font-mono font-black ${financingNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(financingNet)}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Lịch sử thu chi gần đây"
        accent="bg-slate-50"
        note="Danh sách chứng từ có phát sinh qua tài khoản tiền 111/112."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Số CT</th>
                <th className="px-4 py-3">Diễn giải</th>
                <th className="px-4 py-3 text-right">Thu</th>
                <th className="px-4 py-3 text-right">Chi</th>
                <th className="px-4 py-3 text-right">Thuần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {cashVoucherHistory.history.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{getVoucherDate(voucher).split('T')[0] || '---'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700">{voucher.voucherNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{voucher.description}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatCurrency(voucher.inflow)}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">{formatCurrency(voucher.outflow)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${voucher.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(voucher.net)}</td>
                </tr>
              ))}
              {cashVoucherHistory.history.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                    Chưa có phát sinh dòng tiền trong kỳ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}