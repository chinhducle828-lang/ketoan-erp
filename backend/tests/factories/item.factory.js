/**
 * Inventory Item Test Data Factory
 *
 * Generates complete inventory item objects with sensible defaults
 * and partial overrides. Mirrors the shape validated by
 * createItemSchema in backend/validators/index.js.
 */

let sequence = 200;

/**
 * @param {Object} overrides
 * @returns {Object} mock inventory item object
 */
export function createMockItem(overrides = {}) {
  sequence++;
  const defaults = {
    id: sequence,
    company_id: 1,
    item_code: `VT${String(sequence).padStart(4, '0')}`,
    item_name: `Vật tư kiểm thử ${sequence}`,
    unit: 'Cái',
    safety_stock: 0,
    description: 'Vật tư được tạo bởi factory',
  };

  return { ...defaults, ...overrides };
}

/**
 * Create an item with a specific unit of measure.
 * @param {string} unit
 * @param {Object} overrides
 * @returns {Object}
 */
export function createItemWithUnit(unit, overrides = {}) {
  return createMockItem({ unit, ...overrides });
}