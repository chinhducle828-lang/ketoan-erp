/**
 * Ledger (Voucher Detail) Test Data Factory
 *
 * Generates balanced or unbalanced ledger detail lines (định khoản)
 * consistent with the voucher factory and createVoucherSchema.
 */

let sequence = 500;

/**
 * Create a single ledger detail line.
 * @param {Object} overrides
 * @returns {Object}
 */
export function createMockLedgerEntry(overrides = {}) {
  sequence++;
  const defaults = {
    id: sequence,
    account_code: '1111',
    entry_type: 'DR',
    amount: 100000,
    partner_id: null,
    item_id: null,
    quantity: null,
    price: null,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a pair of balanced DR/CR ledger entries.
 * @param {number} amount
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function createBalancedLedger(amount = 100000, options = {}) {
  const {
    drAccount = '1111',
    crAccount = '131',
    drItemId = null,
    crItemId = null,
  } = options;

  return [
    createMockLedgerEntry({
      account_code: drAccount,
      entry_type: 'DR',
      amount,
      item_id: drItemId,
    }),
    createMockLedgerEntry({
      account_code: crAccount,
      entry_type: 'CR',
      amount,
      item_id: crItemId,
    }),
  ];
}

/**
 * Create an unbalanced ledger pair (for negative testing).
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function createUnbalancedLedger(options = {}) {
  const {
    drAmount = 100000,
    crAmount = 90000,
    drAccount = '1111',
    crAccount = '131',
  } = options;

  return [
    createMockLedgerEntry({
      account_code: drAccount,
      entry_type: 'DR',
      amount: drAmount,
    }),
    createMockLedgerEntry({
      account_code: crAccount,
      entry_type: 'CR',
      amount: crAmount,
    }),
  ];
}