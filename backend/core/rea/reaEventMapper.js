/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * reaEventMapper.js - EVENT_PROCESSORS cho mọi nghiệp vụ
 * Config-Driven: mọi tham số đọc từ businessRules.js, KHÔNG hard-code
 */

import { pool } from '../../config/db.js';
import { getAccountBalance } from '../../utils/balanceCalculator.js';
import { getAccountingRules, EVENT_ACCOUNT_REGISTRY, resolveAccounts } from '../../config/businessRules.js';
import { generateEntries as dynamicGenerateEntries } from '../../services/dynamicPosting.service.js';
import { getConfigString } from '../../utils/configHelper.js';

const WORKFLOW_TRIGGER_EVENTS = new Set([
  'SALES_ORDER_CREATED',
  'PURCHASE_REQUISITION_CREATED',
  'INVENTORY_TRANSFER_CREATED',
  'PAYMENT_CREATED'
]);

function createWorkflowTriggerProcessor(eventType) {
  return {
    validate: (data, companyId) => {
      if (!companyId) throw new Error('Thiếu company_id');
      if (!data || typeof data !== 'object') throw new Error('Dữ liệu sự kiện không hợp lệ');
    },
    calculate: (data) => ({
      ...data,
      workflow_trigger: true,
      workflow_trigger_event: eventType,
      workflow_status: 'PENDING'
    }),
    generateEntries: () => []
  };
}

// ====================================================================
// Helper: tính circular chain cho netting
// ====================================================================
function calculateCircularNetting(data) {
  if (data.parties.length < 2) throw new Error('Cần ít nhất 2 bên');
  
  // Xây dựng ma trận nợ: parties[i] nợ parties[j] bao nhiêu
  // Dạng: payable[from][to] = amount
  const n = data.parties.length;
  const payable = Array(n).fill(0).map(() => Array(n).fill(0));
  
  data.parties.forEach((p, i) => {
    // Mỗi party: receivable = số tiền được nhận, payable = số tiền phải trả
    // Trong vòng khép kín, tìm min chain
    data.obligations?.forEach(obl => {
      if (obl.from === p.id) {
        const toIdx = data.parties.findIndex(x => x.id === obl.to);
        if (toIdx >= 0) payable[i][toIdx] = (payable[i][toIdx] || 0) + obl.amount;
      }
    });
  });

  // Tìm min trong vòng khép kín (giả sử vòng A→B→C→D→A)
  let minInChain = Infinity;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    if (payable[i][next] > 0 && payable[i][next] < minInChain) {
      minInChain = payable[i][next];
    }
  }

  if (minInChain === Infinity) minInChain = 0;

  return data.parties.map((p, i) => {
    const prev = (i - 1 + n) % n;
    const receivable = payable[prev][i] || 0;
    const next = (i + 1) % n;
    const pPayable = payable[i][next] || 0;
    const nettedAmount = Math.min(receivable, pPayable, minInChain);

    return {
      ...p,
      receivable,
      payable: pPayable,
      netted_amount: nettedAmount,
      remaining_receivable: receivable - nettedAmount,
      remaining_payable: pPayable - nettedAmount
    };
  });
}

// ====================================================================
// Helper: checkCreditLimit - Kiểm tra hạn mức tín dụng
// ====================================================================
async function checkCreditLimit(companyId, partnerId, newOrderAmount, db) {
  const dbClient = db || pool;

  // 1. Lấy credit_limit từ partners
  const partnerResult = await dbClient.query(
    'SELECT id, partner_name, credit_limit FROM partners WHERE id = $1 AND company_id = $2',
    [partnerId, companyId]
  );
  if (partnerResult.rows.length === 0) throw new Error(`Không tìm thấy partner id=${partnerId}`);
  
  const creditLimit = parseFloat(partnerResult.rows[0].credit_limit) || 0;
  
  // 2. Tính tổng dư nợ TK 131 hiện tại
  const debtResult = await dbClient.query(
    `SELECT COALESCE(SUM(CASE WHEN entry_type = 'DR' THEN amount ELSE -amount END), 0) as current_debt
     FROM voucher_details vd
     JOIN vouchers v ON v.id = vd.voucher_id
     WHERE v.company_id = $1 AND vd.account_code = $3 AND vd.partner_id = $2 AND v.is_posted = TRUE`,
    [companyId, partnerId, getConfigString('accounts.ar', '131', companyId)]
  );
  
  const currentDebt = parseFloat(debtResult.rows[0]?.current_debt) || 0;
  const totalExpected = currentDebt + newOrderAmount;
  const shortage = totalExpected - creditLimit;
  
  return {
    creditLimit,
    currentDebt,
    newOrderAmount,
    totalExpected,
    shortage,
    isExceeded: shortage > 0,
    partnerName: partnerResult.rows[0].partner_name
  };
}

// ====================================================================
// EVENT PROCESSORS - Config-Driven
// ====================================================================
export const EVENT_PROCESSORS = {
  // ----- FACTORING (có/không truy đòi) -----
  'factoring': {
    validate: async (data, companyId) => {
      if (!data.partner_id) throw new Error('Thiếu ngân hàng factoring');
      if (!data.invoice_amount || data.invoice_amount <= 0) throw new Error('Số tiền hóa đơn không hợp lệ');
      if (data.advance_rate !== undefined && (data.advance_rate <= 0 || data.advance_rate > 1)) {
        throw new Error('Tỷ lệ ứng trước phải từ 0-100%');
      }
      if (data.recourse) {
        const arBalance = await getAccountBalance(companyId, getConfigString('accounts.ar', '131', companyId), data.partner_id);
        if ((arBalance.debit_balance || 0) < data.invoice_amount) {
          throw new Error(`Số dư phải thu không đủ để factoring`);
        }
      }
    },

    calculate: (data) => {
      const rules = getAccountingRules().factoring;
      // Tách VAT khỏi hóa đơn (nếu invoice_amount đã bao gồm VAT)
      const vatRate = data.vat_rate || 0.1; // 10% VAT mặc định
      const hasVat = data.includes_vat !== false; // Mặc định đã bao gồm VAT
      const invoiceExclVAT = hasVat ? Math.round(data.invoice_amount / (1 + vatRate)) : data.invoice_amount;
      const invoiceVAT = data.invoice_amount - invoiceExclVAT;
      
      // Phí factoring tính trên giá chưa VAT
      const feeRate = data.fee_rate || 0.02; // 2% mặc định
      const feeAmount = Math.round(invoiceExclVAT * feeRate);
      const feeVAT = Math.round(feeAmount * vatRate);
      const feeTotal = feeAmount + feeVAT;

      // Advance dựa trên input từ form
      const advanceRate = data.advance_rate || 0.8;
      const advanceAmount = Math.round(data.invoice_amount * advanceRate);
      const netProceeds = advanceAmount - feeTotal;
      const remaining = data.invoice_amount - advanceAmount;

      return {
        ...data,
        invoice_excl_vat: invoiceExclVAT,
        invoice_vat: invoiceVAT,
        fee_amount: feeAmount,
        fee_vat: feeVAT,
        fee_total: feeTotal,
        advance_amount: advanceAmount,
        net_proceeds: netProceeds,
        remaining_ar: remaining
      };
    },

    generateEntries: (data) => {
      const rules = getAccountingRules().factoring;
      const entries = [];

      if (data.recourse) {
        // Có truy đòi: Giữ AR, ghi nhận vay + phí
        entries.push(
          { accountCode: rules.advanceAccount, entryType: 'DR', amount: data.net_proceeds, partnerId: data.partner_id },
          { accountCode: rules.feeAccount, entryType: 'DR', amount: data.fee_amount, partnerId: data.partner_id },
          { accountCode: rules.vatAccount, entryType: 'DR', amount: data.fee_vat },
          { accountCode: rules.loanAccount, entryType: 'CR', amount: data.fee_total + data.net_proceeds, partnerId: data.partner_id }
        );
      } else {
        // Không truy đòi: Xóa AR, ghi nhận phải thu ngân hàng (holdback)
        entries.push(
          { accountCode: rules.advanceAccount, entryType: 'DR', amount: data.net_proceeds, partnerId: data.partner_id },
          { accountCode: rules.holdbackAccount, entryType: 'DR', amount: data.remaining_ar, partnerId: data.partner_id },
          { accountCode: rules.feeAccount, entryType: 'DR', amount: data.fee_amount, partnerId: data.partner_id },
          { accountCode: rules.vatAccount, entryType: 'DR', amount: data.fee_vat },
          { accountCode: rules.arAccount, entryType: 'CR', amount: data.invoice_amount, partnerId: data.partner_id }
        );
      }
      return entries;
    }
  },

  // ----- INTERCOMPANY -----
  'intercompany': {
    validate: async (data) => {
      if (!data.from_entity || !data.to_entity) throw new Error('Thiếu thông tin công ty chuyển/nhận');
      if (data.from_entity === data.to_entity) throw new Error('Không thể tự giao dịch với chính mình');
      if (!data.amount || data.amount <= 0) throw new Error('Số tiền không hợp lệ');
    },

    calculate: (data) => {
      let forexAdjustment = 0;
      if (data.from_currency && data.to_currency && data.from_currency !== data.to_currency) {
        const rateDiff = (data.exchange_rate || 1) - (data.original_rate || 1);
        forexAdjustment = Math.round(data.amount * rateDiff);
      }
      return { ...data, forex_adjustment: forexAdjustment };
    },

    generateEntries: (data) => {
      const entries = [];
      entries.push(
        { accountCode: '3311', entryType: 'DR', amount: data.amount, companyId: data.from_entity },
        { accountCode: '1121', entryType: 'CR', amount: data.amount, companyId: data.from_entity },
        { accountCode: '1121', entryType: 'DR', amount: data.amount, companyId: data.to_entity },
        { accountCode: '3311', entryType: 'CR', amount: data.amount, companyId: data.to_entity }
      );
      if (data.forex_adjustment > 0) {
        entries.push(
          { accountCode: '635', entryType: 'DR', amount: data.forex_adjustment, companyId: data.from_entity },
          { accountCode: '3311', entryType: 'CR', amount: data.forex_adjustment, companyId: data.from_entity }
        );
      } else if (data.forex_adjustment < 0) {
        entries.push(
          { accountCode: '3311', entryType: 'DR', amount: Math.abs(data.forex_adjustment), companyId: data.from_entity },
          { accountCode: '515', entryType: 'CR', amount: Math.abs(data.forex_adjustment), companyId: data.from_entity }
        );
      }
      return entries;
    }
  },

  // ----- QUAD-PARTY NETTING (dạng vòng khép kín) -----
  'quad-party-netting': {
    validate: (data) => {
      if (!data.parties || data.parties.length < 2) throw new Error('Cần ít nhất 2 bên');
      if (!data.obligations || data.obligations.length < data.parties.length) {
        throw new Error('Thiếu thông tin nghĩa vụ nợ giữa các bên');
      }
      data.obligations.forEach((obl, i) => {
        if (!obl.from || !obl.to || !obl.amount) {
          throw new Error(`Obligation[${i}] thiếu from, to hoặc amount`);
        }
      });
    },

    calculate: calculateCircularNetting,

    generateEntries: (data) => {
      const rules = getAccountingRules().netting;
      const calculated = calculateCircularNetting(data);
      const entries = [];

      calculated.forEach(p => {
        if (p.netted_amount > 0) {
          entries.push({
            accountCode: rules.receivableAccount,
            entryType: 'DR',
            amount: p.netted_amount,
            partnerId: p.id,
            description: `Cấn trừ công nợ vòng - ${p.name || p.id}`
          });
          entries.push({
            accountCode: rules.payableAccount,
            entryType: 'CR',
            amount: p.netted_amount,
            partnerId: p.id,
            description: `Cấn trừ công nợ vòng - ${p.name || p.id}`
          });
        }
      });

      return entries;
    }
  },

  // ----- FOREX REVALUATION (đa tài khoản, qua TK 4131 trung gian) -----
  'forex-revaluation': {
    validate: (data) => {
      if (!data.accounts || !Array.isArray(data.accounts)) throw new Error('Cần mảng accounts');
      data.accounts.forEach((acc, i) => {
        if (!acc.account_code || !acc.amount_usd || !acc.book_rate) {
          throw new Error(`Account[${i}] thiếu account_code, amount_usd hoặc book_rate`);
        }
      });
      if (!data.market_buy_rate || data.market_buy_rate <= 0) throw new Error('Thiếu tỷ giá mua');
      if (!data.market_sell_rate || data.market_sell_rate <= 0) throw new Error('Thiếu tỷ giá bán');
    },

    calculate: (data) => {
      const rules = getAccountingRules().forex;
      let net4131 = 0; // Dư Nợ 4131 = Lỗ, Dư Có 4131 = Lãi
      const accountResults = data.accounts.map(acc => {
        const mapping = rules.rateTypeMapping.find(m => acc.account_code.startsWith(m.accountPrefix));
        const rateType = mapping?.rateType || 'buy';
        const accountNature = mapping?.nature || 'ASSET';
        const marketRate = rateType === 'buy' ? data.market_buy_rate : data.market_sell_rate;
        const forexDiff = Math.round(acc.amount_usd * (marketRate - acc.book_rate));

        // Với ASSET: rate tăng → LÃI (DR asset, CR 4131)
        // Với LIABILITY: rate tăng → LỖ (DR 4131, CR liability)
        let drAccount, crAccount, drAmount, crAmount;

        if (accountNature === 'ASSET') {
          if (forexDiff > 0) {
            // Lãi: tài sản tăng
            drAccount = acc.account_code;
            crAccount = rules.intermediateAccount;
            drAmount = Math.abs(forexDiff);
            crAmount = Math.abs(forexDiff);
            net4131 -= Math.abs(forexDiff); // 4131 bên Có → giảm dư Nợ
          } else if (forexDiff < 0) {
            // Lỗ: tài sản giảm
            drAccount = rules.intermediateAccount;
            crAccount = acc.account_code;
            drAmount = Math.abs(forexDiff);
            crAmount = Math.abs(forexDiff);
            net4131 += Math.abs(forexDiff); // 4131 bên Nợ → tăng dư Nợ
          } else {
            drAccount = crAccount = null;
            drAmount = crAmount = 0;
          }
        } else {
          // LIABILITY
          if (forexDiff > 0) {
            // Lỗ: nợ phải trả tăng
            drAccount = rules.intermediateAccount;
            crAccount = acc.account_code;
            drAmount = Math.abs(forexDiff);
            crAmount = Math.abs(forexDiff);
            net4131 += Math.abs(forexDiff); // 4131 bên Nợ
          } else if (forexDiff < 0) {
            // Lãi: nợ phải trả giảm
            drAccount = acc.account_code;
            crAccount = rules.intermediateAccount;
            drAmount = Math.abs(forexDiff);
            crAmount = Math.abs(forexDiff);
            net4131 -= Math.abs(forexDiff); // 4131 bên Có
          } else {
            drAccount = crAccount = null;
            drAmount = crAmount = 0;
          }
        }

        const entries = drAccount ? [
          { accountCode: drAccount, entryType: 'DR', amount: drAmount, partnerId: acc.partner_id },
          { accountCode: crAccount, entryType: 'CR', amount: crAmount, partnerId: acc.partner_id }
        ] : [];

        return {
          ...acc,
          applied_rate: marketRate,
          rate_type: rateType,
          account_nature: accountNature,
          forex_diff: forexDiff,
          abs_diff: Math.abs(forexDiff),
          is_gain: (accountNature === 'ASSET' && forexDiff > 0) || (accountNature === 'LIABILITY' && forexDiff < 0),
          entries
        };
      });

      // Bút toán kết chuyển TK 4131 → 635 (nếu lỗ) hoặc 515 (nếu lãi)
      if (net4131 > 0) {
        // 4131 dư Nợ → Lỗ: DR 635 / CR 4131
        accountResults.push({
          account_code: rules.intermediateAccount,
          closing_entry: true,
          entries: [
            { accountCode: rules.lossAccount, entryType: 'DR', amount: net4131 },
            { accountCode: rules.intermediateAccount, entryType: 'CR', amount: net4131 }
          ],
          summary: { type: 'LOSS', amount: net4131 }
        });
      } else if (net4131 < 0) {
        // 4131 dư Có → Lãi: DR 4131 / CR 515
        const gainAmount = Math.abs(net4131);
        accountResults.push({
          account_code: rules.intermediateAccount,
          closing_entry: true,
          entries: [
            { accountCode: rules.intermediateAccount, entryType: 'DR', amount: gainAmount },
            { accountCode: rules.gainAccount, entryType: 'CR', amount: gainAmount }
          ],
          summary: { type: 'GAIN', amount: gainAmount }
        });
      }

      return { ...data, account_results: accountResults };
    },

    generateEntries: (data) => {
      const calculated = EVENT_PROCESSORS['forex-revaluation'].calculate(data);
      const allEntries = [];
      calculated.account_results.forEach(acc => {
        acc.entries.forEach(e => allEntries.push(e));
      });
      return allEntries;
    }
  },

  // ----- SALE (cơ bản) -----
  'sale': {
    validate: (data) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (!data.items || data.items.length === 0) throw new Error('Thiếu sản phẩm');
    },
    calculate: (data) => {
      const total = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
      const vatRate = data.vat_rate || 0.08;
      const vatAmount = Math.round(total * vatRate);
      return { 
        ...data, 
        total_amount: total, 
        vat_amount: vatAmount, 
        grand_total: total + vatAmount,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.sale;
      const accounts = resolveAccounts(reg.revenue.debit);
      const creditAccounts = resolveAccounts(reg.revenue.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.grand_total, partnerId: data.partner_id },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.total_amount },
        { accountCode: creditAccounts[1], entryType: 'CR', amount: data.vat_amount }
      ];
    }
  },

  // ----- RETROACTIVE REBATE (IFRS 15) -----
  'retroactive-rebate': {
    validate: (data) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (!data.rebate_amount || data.rebate_amount <= 0) throw new Error('Số tiền chiết khấu không hợp lệ');
    },
    calculate: (data) => ({ ...data, rebate_amount: Math.round(data.rebate_amount) }),
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY['retroactive-rebate'];
      const accounts = resolveAccounts(reg.exec.debit);
      const creditAccounts = resolveAccounts(reg.exec.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.rebate_amount, partnerId: data.partner_id },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.rebate_amount, partnerId: data.partner_id }
      ];
    }
  },

  // ----- SIMPLE SALE (Bán hàng thu tiền ngay + giá vốn) -----
  'simple_sale': {
    validate: (data) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (!data.items || data.items.length === 0) throw new Error('Thiếu sản phẩm');
    },
    calculate: (data) => {
      const total = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
      const vatRate = data.vat_rate || 0.1;
      const vatAmount = Math.round(total * vatRate);
      const cogs = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.cost_price || 0), 0);
      return {
        ...data,
        total_amount: total,
        vat_amount: vatAmount,
        grand_total: total + vatAmount,
        cogs_amount: cogs,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.simple_sale;
      const rev = resolveAccounts(reg.revenue.debit);
      const revCr = resolveAccounts(reg.revenue.credit);
      const cogs = resolveAccounts(reg.cogs.debit);
      const cogsCr = resolveAccounts(reg.cogs.credit);
      return [
        { accountCode: rev[0], entryType: 'DR', amount: data.grand_total, partnerId: data.partner_id },
        { accountCode: revCr[0], entryType: 'CR', amount: data.total_amount },
        { accountCode: revCr[1], entryType: 'CR', amount: data.vat_amount },
        { accountCode: cogs[0], entryType: 'DR', amount: data.cogs_amount },
        { accountCode: cogsCr[0], entryType: 'CR', amount: data.cogs_amount }
      ];
    }
  },

  // ----- SIMPLE PURCHASE (Mua hàng nhập kho chưa trả tiền) -----
  'simple_purchase': {
    validate: (data) => {
      if (!data.supplier_id) throw new Error('Thiếu nhà cung cấp');
      if (!data.amount || data.amount <= 0) throw new Error('Số tiền không hợp lệ');
      if (data.inventory_type && !['merchandise', 'raw_material'].includes(data.inventory_type)) {
        throw new Error('inventory_type phải là merchandise hoặc raw_material');
      }
    },
    calculate: (data) => {
      const vatRate = data.vat_rate || 0.1;
      const vatAmount = Math.round(data.amount * vatRate);
      return { ...data, vat_amount: vatAmount, grand_total: data.amount + vatAmount, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.simple_purchase;
      const subReg = data.inventory_type === 'raw_material' ? reg.raw_material : reg.merchandise;
      const debitAccounts = resolveAccounts(subReg.debit);
      const creditAccounts = resolveAccounts(subReg.credit);
      
      return [
        { accountCode: debitAccounts[0], entryType: 'DR', amount: data.amount },
        { accountCode: debitAccounts[1], entryType: 'DR', amount: data.vat_amount },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.grand_total, partnerId: data.supplier_id }
      ];
    }
  },

  // ----- SIMPLE EXPENSE (Chi phí quản lý bằng tiền mặt) -----
  'simple_expense': {
    validate: (data) => {
      if (!data.expenses || data.expenses.length === 0) throw new Error('Thiếu danh sách chi phí');
    },
    calculate: (data) => {
      const totalExpense = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalVat = data.expenses.reduce((sum, e) => sum + Math.round((e.amount || 0) * (e.vat_rate || 0.1)), 0);
      return { ...data, total_expense: totalExpense, total_vat: totalVat, total_cash: totalExpense + totalVat, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.simple_expense;
      const accounts = resolveAccounts(reg.exec.debit);
      const creditAccounts = resolveAccounts(reg.exec.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.total_expense },
        { accountCode: accounts[1], entryType: 'DR', amount: data.total_vat },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.total_cash }
      ];
    }
  },

  // ====================================================================
  // 10 BÀI TOÁN NGHIỆP VỤ THEO PHÒNG BAN
  // ====================================================================

  // ----- 1. SALES: Cơ hội bán hàng (Workflow - không bút toán) -----
  'sales_opportunity': {
    validate: (data) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (!data.total_amount || data.total_amount <= 0) throw new Error('Giá trị không hợp lệ');
    },
    calculate: (data) => {
      const discountRate = data.discount_rate || 0;
      const maxAllowedDiscount = data.max_discount_rate || 0.15;
      if (discountRate > maxAllowedDiscount) {
        data.needs_approval = true;
        data.approval_note = `Chiết khấu ${(discountRate * 100).toFixed(0)}% vượt mức ${(maxAllowedDiscount * 100).toFixed(0)}%, cần phê duyệt trưởng phòng`;
      }
      return data;
    },
    generateEntries: () => [] // Workflow event, không sinh bút toán
  },

  // ----- 2. SALES: Bán hàng xuất kho thu tiền sau (kèm credit limit check) -----
  'sales_credit': {
    validate: async (data, companyId) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (!data.items || data.items.length === 0) throw new Error('Thiếu sản phẩm');
      
      // Tính tổng đơn hàng mới
      const total = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
      const vatRate = data.vat_rate || 0.1;
      const vatAmount = Math.round(total * vatRate);
      const grandTotal = total + vatAmount;
      
      // Kiểm tra hạn mức tín dụng
      const creditCheck = await checkCreditLimit(companyId, data.partner_id, grandTotal);
      if (creditCheck.isExceeded) {
        const error = new Error(`CREDIT_LIMIT_EXCEEDED`);
        error.creditCheck = creditCheck;
        throw error;
      }
    },
    calculate: (data) => {
      const total = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
      const vatRate = data.vat_rate || 0.1;
      const vatAmount = Math.round(total * vatRate);
      const cogs = data.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.cost_price || 0), 0);
      return { ...data, total_amount: total, vat_amount: vatAmount, grand_total: total + vatAmount, cogs_amount: cogs, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.sales_credit;
      const revDebit = resolveAccounts(reg.revenue.debit)[0];
      const revCredits = resolveAccounts(reg.revenue.credit);
      const cogsDebit = resolveAccounts(reg.cogs.debit)[0];
      const cogsCredit = resolveAccounts(reg.cogs.credit)[0];
      
      return [
        { accountCode: revDebit, entryType: 'DR', amount: data.grand_total, partnerId: data.partner_id },
        { accountCode: revCredits[0], entryType: 'CR', amount: data.total_amount },
        { accountCode: revCredits[1], entryType: 'CR', amount: data.vat_amount },
        { accountCode: cogsDebit, entryType: 'DR', amount: data.cogs_amount },
        { accountCode: cogsCredit, entryType: 'CR', amount: data.cogs_amount }
      ];
    }
  },

  // ----- 3. PROCUREMENT: Yêu cầu mua hàng (Workflow) -----
  'purchase_requisition': {
    validate: (data) => {
      if (!data.items || data.items.length === 0) throw new Error('Thiếu danh sách vật tư');
      if (!data.suppliers || data.suppliers.length < 1) throw new Error('Cần ít nhất 1 nhà cung cấp báo giá');
    },
    calculate: (data) => {
      // Chọn nhà cung cấp tốt nhất (giá thấp nhất)
      const bestSupplier = data.suppliers.reduce((best, s) => (s.total_price < best.total_price ? s : best), data.suppliers[0]);
      return { ...data, selected_supplier: bestSupplier };
    },
    generateEntries: () => []
  },

  // ----- 4. PROCUREMENT: Mua hàng nhập kho kèm chi phí vận chuyển -----
  'purchase_with_fee': {
    validate: (data) => {
      if (!data.amount || data.amount <= 0) throw new Error('Số tiền hàng không hợp lệ');
      if (!data.supplier_id) throw new Error('Thiếu nhà cung cấp');
    },
    calculate: (data) => {
      const vatRate = data.vat_rate || 0.1;
      const transportFee = data.transport_fee || 0;
      const totalGoods = data.amount + transportFee;
      const vatAmount = Math.round((data.amount + transportFee) * vatRate);
      const goodsVat = Math.round(data.amount * vatRate);
      const transportVat = Math.round(transportFee * vatRate);
      return {
        ...data,
        total_goods_value: totalGoods,
        vat_amount: vatAmount,
        grand_total: totalGoods + vatAmount,
        goods_vat: goodsVat,
        transport_vat: transportVat,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.purchase_with_fee;
      const accounts = resolveAccounts(reg.exec.debit);
      const creditAccounts = resolveAccounts(reg.exec.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.total_goods_value },
        { accountCode: accounts[1], entryType: 'DR', amount: data.vat_amount },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.amount + data.goods_vat, partnerId: data.supplier_id },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: (data.transport_fee || 0) + data.transport_vat, partnerId: data.transport_supplier_id || 0 }
      ];
    }
  },

  // ----- 5. INVENTORY: Chuyển kho nội bộ (REA event, không bút toán) -----
  'inventory_transfer': {
    validate: (data) => {
      if (!data.from_warehouse || !data.to_warehouse) throw new Error('Thiếu kho nguồn/đích');
      if (!data.items || data.items.length === 0) throw new Error('Thiếu hàng hóa chuyển');
    },
    calculate: (data) => data,
    generateEntries: () => []
  },

  // ----- 6. INVENTORY: Kiểm kê phát hiện thừa/thiếu -----
  'inventory_audit': {
    validate: (data) => {
      if (!data.difference_amount || data.difference_amount === 0) throw new Error('Số tiền chênh lệch phải khác 0');
    },
    calculate: (data) => {
      const isShortage = data.difference_amount > 0;
      return { ...data, is_shortage: isShortage, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.inventory_audit;
      const subReg = data.is_shortage ? reg.shortage : reg.surplus;
      const accounts = resolveAccounts(subReg.debit);
      const creditAccounts = resolveAccounts(subReg.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: Math.abs(data.difference_amount) },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: Math.abs(data.difference_amount) }
      ];
    }
  },

  // ----- 7. HR: Tính lương và bảo hiểm -----
  'payroll_distribution': {
    validate: (data) => {
      if (!data.gross_salary || data.gross_salary <= 0) throw new Error('Quỹ lương không hợp lệ');
    },
    calculate: (data) => {
      const employerInsuranceRate = data.employer_insurance_rate || 0.215;
      const employeeInsuranceRate = data.employee_insurance_rate || 0.105;
      const employerInsurance = Math.round(data.gross_salary * employerInsuranceRate);
      const employeeInsurance = Math.round(data.gross_salary * employeeInsuranceRate);
      return {
        ...data,
        employer_insurance: employerInsurance,
        employee_insurance: employeeInsurance,
        total_employer_cost: data.gross_salary + employerInsurance,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.payroll_distribution;
      const companyDebit = resolveAccounts(reg.company_share.debit)[0];
      const companyCredits = resolveAccounts(reg.company_share.credit);
      const deductDebit = resolveAccounts(reg.deduct_worker.debit)[0];
      const deductCredit = resolveAccounts(reg.deduct_worker.credit)[0];
      return [
        { accountCode: companyDebit, entryType: 'DR', amount: data.gross_salary },
        { accountCode: companyDebit, entryType: 'DR', amount: data.employer_insurance },
        { accountCode: companyCredits[0], entryType: 'CR', amount: data.gross_salary },
        { accountCode: companyCredits[1], entryType: 'CR', amount: data.employer_insurance + data.employee_insurance }
      ];
    }
  },

  // ----- 8. MANUFACTURING: Xuất NVL và tính giá thành -----
  'manufacturing_cogs': {
    validate: (data) => {
      if (!data.material_cost && !data.labor_cost && !data.overhead_cost) throw new Error('Thiếu chi phí sản xuất');
    },
    calculate: (data) => {
      const totalCost = (data.material_cost || 0) + (data.labor_cost || 0) + (data.overhead_cost || 0);
      return { ...data, total_cost: totalCost, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.manufacturing_cogs;
      const wipDebit = resolveAccounts(reg.wip_collect.debit)[0];
      const wipCredits = resolveAccounts(reg.wip_collect.credit);
      const finishDebit = resolveAccounts(reg.finish.debit)[0];
      const finishCredit = resolveAccounts(reg.finish.credit)[0];
      
      return [
        // Tập hợp chi phí vào WIP
        { accountCode: wipDebit, entryType: 'DR', amount: data.total_cost },
        { accountCode: wipCredits[0], entryType: 'CR', amount: data.material_cost || 0 },
        { accountCode: wipCredits[1], entryType: 'CR', amount: data.labor_cost || 0 },
        { accountCode: wipCredits[2], entryType: 'CR', amount: data.overhead_cost || 0 },
        // Nhập kho thành phẩm
        { accountCode: finishDebit, entryType: 'DR', amount: data.total_cost },
        { accountCode: finishCredit, entryType: 'CR', amount: data.total_cost }
      ];
    }
  },

  // ----- 9. FINANCE: Trích khấu hao TSCĐ -----
  'asset_depreciation': {
    validate: (data) => {
      if (!data.asset_id) throw new Error('Thiếu tài sản cố định');
      if (!data.depreciation_amount || data.depreciation_amount <= 0) throw new Error('Số tiền khấu hao không hợp lệ');
    },
    calculate: (data) => data,
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.asset_depreciation;
      const accounts = resolveAccounts(reg.monthly.debit);
      const creditAccounts = resolveAccounts(reg.monthly.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.depreciation_amount, partnerId: data.asset_id },
        { accountCode: creditAccounts[0], entryType: 'CR', amount: data.depreciation_amount }
      ];
    }
  },

  // ----- 10. FINANCE: Tạm ứng và thanh toán công tác phí -----
  'advance_clearing': {
    validate: (data) => {
      if (!data.employee_id) throw new Error('Thiếu nhân viên');
      if (!data.advance_amount || data.advance_amount <= 0) throw new Error('Số tiền tạm ứng không hợp lệ');
    },
    calculate: (data) => {
      const settledAmount = data.settled_amount || 0;
      const refundAmount = data.advance_amount - settledAmount;
      return { ...data, settled_amount: settledAmount, refund_amount: refundAmount, dimensions: data.dimensions || {} };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.advance_clearing;
      const requestAccounts = resolveAccounts(reg.request.debit);
      const requestCredit = resolveAccounts(reg.request.credit)[0];
      const settleAccounts = resolveAccounts(reg.settle.debit);
      const settleCredit = resolveAccounts(reg.settle.credit)[0];
      
      return [
        // Bước 1: Tạm ứng
        { accountCode: requestAccounts[0], entryType: 'DR', amount: data.advance_amount, partnerId: data.employee_id },
        { accountCode: requestCredit, entryType: 'CR', amount: data.advance_amount },
        // Bước 2: Quyết toán (nếu có)
        ...(data.settled_amount > 0 ? [
          { accountCode: settleAccounts[0], entryType: 'DR', amount: data.settled_amount, partnerId: data.employee_id },
          ...(data.refund_amount > 0 ? [{ accountCode: settleAccounts[1], entryType: 'DR', amount: data.refund_amount }] : []),
          { accountCode: settleCredit, entryType: 'CR', amount: data.advance_amount, partnerId: data.employee_id }
        ] : [])
      ];
    }
  },

  // ----- EARLY PAYMENT (Chiết khấu thanh toán sớm - Cash Flow Optimization) -----
  'early_payment': {
    validate: (data) => {
      if (!data.partner_id) throw new Error('Thiếu khách hàng');
      if (data.debt_amount || data.debt_amount <= 0) throw new Error('Số nợ phải thu không hợp lệ');
      if (data.discount_rate !== undefined && (data.discount_rate < 0 || data.discount_rate > 1)) {
        throw new Error('Tỷ lệ chiết khấu phải từ 0-100%');
      }
      if (!data.payment_amount || data.payment_amount <= 0) throw new Error('Số tiền thanh toán không hợp lệ');
    },
    calculate: (data) => {
      const rules = getAccountingRules().earlyPayment;
      const discountRate = data.discount_rate || rules.discountRate;
      const discountAmount = Math.round(data.debt_amount * discountRate);
      const netReceived = data.debt_amount - discountAmount;
      return {
        ...data,
        discount_rate: discountRate,
        discount_amount: discountAmount,
        net_received: netReceived,
        bank_account: rules.bankAccount,
        expense_account: rules.expenseAccount,
        ar_account: rules.arAccount,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.early_payment;
      const accounts = resolveAccounts(reg.exec.debit);
      const crAccounts = resolveAccounts(reg.exec.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.net_received, partnerId: data.partner_id },
        { accountCode: accounts[1], entryType: 'DR', amount: data.discount_amount, partnerId: data.partner_id },
        { accountCode: crAccounts[0], entryType: 'CR', amount: data.debt_amount, partnerId: data.partner_id }
      ];
    }
  },

  // ----- PURCHASE ORDER CREATED (Đặt hàng nhập kho) -----
  'purchase_order_created': {
    validate: (data) => {
      if (!data.supplier_id) throw new Error('Thiếu nhà cung cấp');
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Đơn hàng phải có ít nhất 1 sản phẩm');
      }
    },
    calculate: (data) => {
      const totalAmount = data.items.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_price);
      }, 0);
      return {
        ...data,
        total_amount: totalAmount,
        status: 'PENDING_APPROVAL',
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      // Purchase order không tạo bút toán ngay - chỉ ghi nhận khi nhập kho
      return [];
    }
  },

  // ----- SALES SHIPPED AND BILLED (Xuất kho và lập hóa đơn) -----
  'sales_shipped_and_billed': {
    validate: (data) => {
      if (!data.customer_id) throw new Error('Thiếu khách hàng');
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Đơn hàng phải có ít nhất 1 sản phẩm');
      }
      if (!data.shipping_date) throw new Error('Thiếu ngày xuất kho');
    },
    calculate: (data) => {
      const subtotal = data.items.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_price);
      }, 0);
      const taxAmount = Math.round(subtotal * (data.tax_rate || 0.08));
      const totalAmount = subtotal + taxAmount;
      return {
        ...data,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        shipping_date: data.shipping_date,
        invoice_date: data.invoice_date || data.shipping_date,
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.sales_credit || EVENT_ACCOUNT_REGISTRY.sale;
      const accounts = resolveAccounts(reg.revenue.debit);
      const crAccounts = resolveAccounts(reg.revenue.credit);
      const entries = [
        { accountCode: accounts[0], entryType: 'DR', amount: data.total_amount, partnerId: data.customer_id },
        { accountCode: crAccounts[0], entryType: 'CR', amount: data.subtotal, partnerId: data.customer_id }
      ];
      if (data.tax_amount > 0) {
        entries.push({ accountCode: crAccounts[1], entryType: 'CR', amount: data.tax_amount, partnerId: data.customer_id });
      }
      return entries;
    }
  },

  // ----- INVENTORY RECEIVED (Nhập kho từ nhà cung cấp) -----
  'inventory_received': {
    validate: (data) => {
      if (!data.supplier_id) throw new Error('Thiếu nhà cung cấp');
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Phiếu nhập phải có ít nhất 1 sản phẩm');
      }
      if (!data.warehouse_id) throw new Error('Thiếu kho nhập');
    },
    calculate: (data) => {
      const totalAmount = data.items.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_cost);
      }, 0);
      return {
        ...data,
        total_amount: totalAmount,
        received_date: data.received_date || new Date().toISOString().split('T')[0],
        dimensions: data.dimensions || {}
      };
    },
    generateEntries: (data) => {
      const reg = EVENT_ACCOUNT_REGISTRY.simple_purchase;
      const accounts = resolveAccounts(reg.merchandise.debit);
      const crAccounts = resolveAccounts(reg.merchandise.credit);
      return [
        { accountCode: accounts[0], entryType: 'DR', amount: data.total_amount, partnerId: data.supplier_id },
        { accountCode: crAccounts[0], entryType: 'CR', amount: data.total_amount, partnerId: data.supplier_id }
      ];
    }
  }
};

/**
 * Lấy processor cho 1 loại nghiệp vụ
 */
export function getEventProcessor(eventType) {
  const processor = EVENT_PROCESSORS[eventType];
  if (processor) return processor;

  const normalizedEventType = String(eventType || '').trim().toUpperCase();
  if (WORKFLOW_TRIGGER_EVENTS.has(normalizedEventType)) {
    return createWorkflowTriggerProcessor(normalizedEventType);
  }

  throw new Error(`Không tìm thấy processor cho nghiệp vụ: ${eventType}`);
}

/**
 * Gọi an toàn 1 function (tránh lỗi type)
 */
export function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}