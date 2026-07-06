/**
 * Accounting API Routes
 * Expose accounting engine functions for frontend consumption
 * Single source of truth: backend/utils/accountingEngine.js
 */

import { Router } from 'express';
import { getClosingRules } from '../config/businessRules.js';
import { 
  calculateBalances, 
  getClosingBalance, 
  getTotalDebit, 
  getTotalCredit,
  calculateProfitBeforeTax
} from '../utils/accountingEngine.js';

const router = Router();

/**
 * POST /api/accounting/balances
 * Calculate account balances from vouchers
 * Body: { vouchers: [...], openingBalances: [...] }
 */
router.post('/balances', (req, res) => {
  try {
    const { vouchers, openingBalances } = req.body;
    
    if (!Array.isArray(vouchers)) {
      return res.status(400).json({ error: 'vouchers must be an array' });
    }
    
    const ledger = calculateBalances(vouchers, openingBalances || []);
    
    res.json({
      success: true,
      data: ledger
    });
  } catch (error) {
    console.error('Error calculating balances:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate balances',
      message: error.message 
    });
  }
});

/**
 * POST /api/accounting/closing-balance
 * Get closing balance for a specific account
 * Body: { ledger: {...}, accountCode: '131', accountType: 'asset', partnerId: null }
 */
router.post('/closing-balance', (req, res) => {
  try {
    const { ledger, accountCode, accountType = 'asset', partnerId = null } = req.body;
    
    if (!ledger || !accountCode) {
      return res.status(400).json({ error: 'ledger and accountCode are required' });
    }
    
    const balance = getClosingBalance(ledger, accountCode, accountType, partnerId);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    console.error('Error getting closing balance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get closing balance',
      message: error.message 
    });
  }
});

/**
 * POST /api/accounting/total-debit
 * Get total debit for an account
 * Body: { ledger: {...}, accountCode: '511' }
 */
router.post('/total-debit', (req, res) => {
  try {
    const { ledger, accountCode } = req.body;
    
    if (!ledger || !accountCode) {
      return res.status(400).json({ error: 'ledger and accountCode are required' });
    }
    
    const total = getTotalDebit(ledger, accountCode);
    
    res.json({
      success: true,
      data: total
    });
  } catch (error) {
    console.error('Error getting total debit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get total debit',
      message: error.message 
    });
  }
});

/**
 * POST /api/accounting/total-credit
 * Get total credit for an account
 * Body: { ledger: {...}, accountCode: '511' }
 */
router.post('/total-credit', (req, res) => {
  try {
    const { ledger, accountCode } = req.body;
    
    if (!ledger || !accountCode) {
      return res.status(400).json({ error: 'ledger and accountCode are required' });
    }
    
    const total = getTotalCredit(ledger, accountCode);
    
    res.json({
      success: true,
      data: total
    });
  } catch (error) {
    console.error('Error getting total credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get total credit',
      message: error.message 
    });
  }
});

/**
 * GET /api/accounting/tax-rate/:revenue
 * Get the current corporate income tax rate.
 * Revenue is accepted for compatibility but a flat rate is used per business rules.
 */
router.get('/tax-rate/:revenue', (req, res) => {
  try {
    const revenue = parseFloat(req.params.revenue);
    
    if (isNaN(revenue)) {
      return res.status(400).json({ error: 'revenue must be a number' });
    }

    const closingRules = getClosingRules();
    const taxRate = Number(closingRules.defaultTaxRate ?? 0.2);
    
    res.json({
      success: true,
      data: {
        revenue,
        taxRate,
        taxRatePercent: taxRate * 100
      }
    });
  } catch (error) {
    console.error('Error getting tax rate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get tax rate',
      message: error.message 
    });
  }
});

/**
 * POST /api/accounting/profit-before-tax
 * Calculate profit before tax
 * Body: { revenue, otherIncome, costOfGoodsSold, operatingExpenses, otherExpenses, taxExpense }
 */
router.post('/profit-before-tax', (req, res) => {
  try {
    const { 
      revenue, 
      otherIncome, 
      costOfGoodsSold, 
      operatingExpenses, 
      otherExpenses, 
      taxExpense = 0 
    } = req.body;
    
    const profit = calculateProfitBeforeTax(
      revenue || 0,
      otherIncome || 0,
      costOfGoodsSold || 0,
      operatingExpenses || 0,
      otherExpenses || 0,
      taxExpense || 0
    );
    
    res.json({
      success: true,
      data: {
        profitBeforeTax: profit
      }
    });
  } catch (error) {
    console.error('Error calculating profit before tax:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate profit before tax',
      message: error.message 
    });
  }
});

export default router;