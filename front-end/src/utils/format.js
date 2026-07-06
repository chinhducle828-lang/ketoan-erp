/**
 * Number Formatting Helper - Currency and Financial Values
 * Provides consistent formatting for financial data across the ERP system
 */

/**
 * Format a number as Vietnamese currency (VND)
 * @param {number} value - The numeric value to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
  const {
    currency = 'VND',
    decimals = 0,
    showCurrency = true,
    locale = 'vi-VN'
  } = options;

  const numValue = Number(value) || 0;
  
  if (showCurrency) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(numValue);
  }
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue);
};

/**
 * Format a number for display (thousands separator)
 * @param {number} value - The numeric value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 0) => {
  const numValue = Number(value) || 0;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue);
};

/**
 * Get CSS class for text alignment based on value type
 * @param {string} type - 'currency', 'number', or 'default'
 * @returns {string} CSS class name
 */
export const getAlignmentClass = (type = 'default') => {
  const alignmentMap = {
    currency: 'text-right',
    number: 'text-right',
    default: 'text-left'
  };
  return alignmentMap[type] || 'text-left';
};

/**
 * Format date for display
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string (DD/MM/YYYY)
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN');
};

/**
 * Format date for input field (YYYY-MM-DD)
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export default {
  formatCurrency,
  formatNumber,
  getAlignmentClass,
  formatDate,
  formatDateForInput
};