/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * useAccounting Hook
 * Frontend hook để gọi API accounting từ backend
 * Single source of truth: backend/utils/accountingEngine.js
 */

import { useState, useCallback } from 'react';
import api from '../utils/api.js';
import { getCorporateIncomeTaxRate } from '../utils/accountingRules.js';

export function useAccounting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Calculate balances from vouchers
   * @param {Array} vouchers - Array of vouchers with details
   * @param {Array} openingBalances - Array of opening balances
   * @returns {Promise<Object>} Ledger object
   */
  const calculateBalances = useCallback(async (vouchers, openingBalances = []) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/accounting/balances', {
        vouchers,
        openingBalances
      });
      
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error(response.data?.error || 'Failed to calculate balances');
    } catch (err) {
      setError(err.message);
      console.error('Error calculating balances:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get closing balance for a specific account
   * @param {Object} ledger - Ledger object
   * @param {string} accountCode - Account code
   * @param {string} accountType - Account type (asset, liability, etc.)
   * @param {number|null} partnerId - Partner ID for hermaphroditic accounts
   * @returns {Promise<number|Object>} Balance value
   */
  const getClosingBalance = useCallback(async (ledger, accountCode, accountType = 'asset', partnerId = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/accounting/closing-balance', {
        ledger,
        accountCode,
        accountType,
        partnerId
      });
      
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error(response.data?.error || 'Failed to get closing balance');
    } catch (err) {
      setError(err.message);
      console.error('Error getting closing balance:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get total debit for an account
   * @param {Object} ledger - Ledger object
   * @param {string} accountCode - Account code
   * @returns {Promise<number>} Total debit
   */
  const getTotalDebit = useCallback(async (ledger, accountCode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/accounting/total-debit', {
        ledger,
        accountCode
      });
      
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error(response.data?.error || 'Failed to get total debit');
    } catch (err) {
      setError(err.message);
      console.error('Error getting total debit:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get total credit for an account
   * @param {Object} ledger - Ledger object
   * @param {string} accountCode - Account code
   * @returns {Promise<number>} Total credit
   */
  const getTotalCredit = useCallback(async (ledger, accountCode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/accounting/total-credit', {
        ledger,
        accountCode
      });
      
      if (response.data?.success) {
        return response.data.data;
      }
      throw new Error(response.data?.error || 'Failed to get total credit');
    } catch (err) {
      setError(err.message);
      console.error('Error getting total credit:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get tax rate based on revenue
   * @param {number} revenue - Revenue amount
   * @returns {Promise<number>} Tax rate
   */
  const getTaxRateByRevenue = useCallback(async (revenue) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/accounting/tax-rate/${revenue}`);
      
      if (response.data?.success) {
        return response.data.data.taxRate;
      }
      throw new Error(response.data?.error || 'Failed to get tax rate');
    } catch (err) {
      setError(err.message);
      console.error('Error getting tax rate:', err);
      return getCorporateIncomeTaxRate();
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calculate profit before tax
   * @param {number} revenue - Revenue
   * @param {number} otherIncome - Other income
   * @param {number} costOfGoodsSold - COGS
   * @param {number} operatingExpenses - Operating expenses
   * @param {number} otherExpenses - Other expenses
   * @param {number} taxExpense - Tax expense
   * @returns {Promise<number>} Profit before tax
   */
  const calculateProfitBeforeTax = useCallback(async (
    revenue,
    otherIncome,
    costOfGoodsSold,
    operatingExpenses,
    otherExpenses,
    taxExpense = 0
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/accounting/profit-before-tax', {
        revenue,
        otherIncome,
        costOfGoodsSold,
        operatingExpenses,
        otherExpenses,
        taxExpense
      });
      
      if (response.data?.success) {
        return response.data.data.profitBeforeTax;
      }
      throw new Error(response.data?.error || 'Failed to calculate profit before tax');
    } catch (err) {
      setError(err.message);
      console.error('Error calculating profit before tax:', err);
      return 0;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    calculateBalances,
    getClosingBalance,
    getTotalDebit,
    getTotalCredit,
    getTaxRateByRevenue,
    calculateProfitBeforeTax
  };
}