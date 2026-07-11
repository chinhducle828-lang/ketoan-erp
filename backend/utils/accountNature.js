/**
 * Account Nature Utility - Helper functions for determining account types
 * and calculating NET balances based on account nature (DEBIT/CREDIT/BOTH)
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { getAccountNature, ACCOUNT_NATURES } from '../config/businessRules.js';

/**
 * Calculate NET balance for an account based on its nature
 * 
 * @param {number} debitAmount - Total debit amount
 * @param {number} creditAmount - Total credit amount
 * @param {string} accountNature - Account nature (DEBIT, CREDIT, or BOTH)
 * @returns {Object} { netBalance: number, balanceType: string }
 */
export const calculateNetBalance = (debitAmount, creditAmount, accountNature) => {
  const debit = parseFloat(debitAmount) || 0;
  const credit = parseFloat(creditAmount) || 0;
  
  switch (accountNature) {
    case ACCOUNT_NATURES.DEBIT:
      // For DEBIT accounts: NET = Debit - Credit
      // If positive → balance is on DEBIT side
      // If negative → balance is on CREDIT side (exceptional case)
      const netDebit = debit - credit;
      return {
        netBalance: Math.abs(netDebit),
        balanceType: netDebit >= 0 ? ACCOUNT_NATURES.DEBIT : ACCOUNT_NATURES.CREDIT
      };
      
    case ACCOUNT_NATURES.CREDIT:
      // For CREDIT accounts: NET = Credit - Debit
      // If positive → balance is on CREDIT side
      // If negative → balance is on DEBIT side (exceptional case)
      const netCredit = credit - debit;
      return {
        netBalance: Math.abs(netCredit),
        balanceType: netCredit >= 0 ? ACCOUNT_NATURES.CREDIT : ACCOUNT_NATURES.DEBIT
      };
      
    case ACCOUNT_NATURES.BOTH:
      // For BOTH accounts (dual nature like 131, 331):
      // Keep separate debit and credit, don't net them
      // Return the larger side as the net balance
      if (debit >= credit) {
        return {
          netBalance: debit - credit,
          balanceType: ACCOUNT_NATURES.DEBIT
        };
      } else {
        return {
          netBalance: credit - debit,
          balanceType: ACCOUNT_NATURES.CREDIT
        };
      }
      
    default:
      // Fallback to DEBIT behavior
      return {
        netBalance: Math.abs(debit - credit),
        balanceType: debit >= credit ? ACCOUNT_NATURES.DEBIT : ACCOUNT_NATURES.CREDIT
      };
  }
};

/**
 * Get account nature for a given account code
 * Wrapper around getAccountNature from businessRules.js for convenience
 * 
 * @param {string} accountCode - Account code (e.g., '111', '131', '2141')
 * @returns {string} Account nature (DEBIT, CREDIT, or BOTH)
 */
export const getAccountNatureWrapper = (accountCode) => {
  return getAccountNature(accountCode);
};

/**
 * Format balance for display with DR/CR indicator
 * 
 * @param {number} amount - Balance amount
 * @param {string} balanceType - DEBIT or CREDIT
 * @returns {string} Formatted balance string (e.g., "1,000,000 DR" or "(500,000 CR)")
 */
export const formatBalanceWithType = (amount, balanceType) => {
  const formattedAmount = Math.abs(amount).toLocaleString('vi-VN');
  
  if (balanceType === ACCOUNT_NATURES.CREDIT) {
    return `${formattedAmount} CR`;
  } else {
    return `${formattedAmount} DR`;
  }
};

/**
 * Calculate net balance for multiple accounts grouped by account code
 * Useful for trial balance reports
 * 
 * @param {Array} balances - Array of { account_code, debit, credit }
 * @returns {Array} Array with net_balance and balance_type added
 */
export const calculateNetBalancesForAccounts = (balances) => {
  return balances.map(balance => {
    const accountNature = getAccountNatureWrapper(balance.account_code);
    const { netBalance, balanceType } = calculateNetBalance(
      balance.debit || 0,
      balance.credit || 0,
      accountNature
    );
    
    return {
      ...balance,
      net_balance: netBalance,
      balance_type: balanceType,
      account_nature: accountNature
    };
  });
};

/**
 * Aggregate balances by account code (summing across partners)
 * For BOTH accounts, we need special handling to keep debit/credit separate
 * 
 * @param {Array} entries - Array of { account_code, partner_id, debit, credit }
 * @returns {Array} Aggregated balances by account_code
 */
export const aggregateBalancesByAccount = (entries) => {
  const aggregated = {};
  
  entries.forEach(entry => {
    const key = entry.account_code;
    
    if (!aggregated[key]) {
      aggregated[key] = {
        account_code: key,
        debit: 0,
        credit: 0
      };
    }
    
    aggregated[key].debit += parseFloat(entry.debit) || 0;
    aggregated[key].credit += parseFloat(entry.credit) || 0;
  });
  
  return Object.values(aggregated);
};

/**
 * Check if an account is a dual nature account (BOTH)
 * 
 * @param {string} accountCode - Account code
 * @returns {boolean} True if account is BOTH nature
 */
export const isDualNatureAccount = (accountCode) => {
  return getAccountNatureWrapper(accountCode) === ACCOUNT_NATURES.BOTH;
};

/**
 * Get display balance for financial statements
 * For DEBIT accounts: show in debit column
 * For CREDIT accounts: show in credit column
 * For BOTH accounts: show in both columns based on net balance
 * 
 * @param {number} netBalance - Net balance amount
 * @param {string} balanceType - DEBIT or CREDIT
 * @returns {Object} { debitDisplay, creditDisplay }
 */
export const getDisplayBalance = (netBalance, balanceType) => {
  if (balanceType === ACCOUNT_NATURES.DEBIT) {
    return {
      debitDisplay: netBalance,
      creditDisplay: 0
    };
  } else {
    return {
      debitDisplay: 0,
      creditDisplay: netBalance
    };
  }
};