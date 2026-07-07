/**
 * Company Test Data Factory
 */

let sequence = 100;

/**
 * @param {Object} overrides
 * @returns {Object} mock company object
 */
export function createMockCompany(overrides = {}) {
  sequence++;
  const defaults = {
    id: sequence,
    name: `Công ty Kiểm thử ${sequence}`,
    tax_code: `0${String(sequence).padStart(9, '0')}`,
    address: 'Hà Nội',
    fiscal_year: 2026,
    lock_date: null,
    entity_type: 'company',
  };

  return { ...defaults, ...overrides };
}