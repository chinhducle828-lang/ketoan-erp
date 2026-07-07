/**
 * User Test Data Factory
 */

let sequence = 50;

const ROLES = ['admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho'];

/**
 * @param {Object} overrides
 * @returns {Object} mock user object
 */
export function createMockUser(overrides = {}) {
  sequence++;
  const defaults = {
    id: sequence,
    username: `testuser_${sequence}`,
    password: 'hashed_password_placeholder',
    role: 'nv',
    full_name: `Người dùng ${sequence}`,
    email: `user${sequence}@company.com`,
    company_ids: [1],
    staff_ids: [],
    must_change_password: false,
  };

  return { ...defaults, ...overrides };
}

/**
 * Create a user with a specific role.
 * @param {string} role
 * @param {Object} overrides
 * @returns {Object}
 */
export function createUserWithRole(role, overrides = {}) {
  if (!ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
  }
  return createMockUser({ role, ...overrides });
}