/**
 * Data-Driven (Parameterized) Validator Tests
 *
 * Extends existing validators.test.js with Jest's test.each
 * for comprehensive coverage of voucher validation rules.
 */

import { describe, expect, test } from '@jest/globals';
import { createVoucherSchema, createItemSchema, registerAdminSchema, loginSchema, createUserSchema } from '../validators/index.js';

// ─── Voucher Validation Data Table ───

const voucherTestCases = [
  // Valid cases
  {
    name: 'valid NK purchase entry',
    data: {
      voucherDate: '2026-01-15',
      description: 'Mua hàng nhập kho',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '156', entryType: 'DR', amount: 50000000 },
        { accountCode: '331', entryType: 'CR', amount: 50000000 },
      ],
    },
    expected: true,
  },
  {
    name: 'valid PT receipt entry',
    data: {
      voucherDate: '2026-01-15',
      description: 'Thu tiền bán hàng',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 10000000 },
        { accountCode: '131', entryType: 'CR', amount: 10000000 },
      ],
    },
    expected: true,
  },
  {
    name: 'valid multi-row with 3 lines balanced',
    data: {
      voucherDate: '2026-01-15',
      description: 'Chi tiền mặt nhập kho - đa dòng',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '152', entryType: 'DR', amount: 800000 },
        { accountCode: '1331', entryType: 'DR', amount: 80000 },
        { accountCode: '1111', entryType: 'CR', amount: 880000 },
      ],
    },
    expected: true,
  },
  {
    name: 'valid PC payment entry',
    data: {
      voucherDate: '2026-06-30',
      description: 'Chi trả nhà cung cấp',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '331', entryType: 'DR', amount: 220000000 },
        { accountCode: '1121', entryType: 'CR', amount: 220000000 },
      ],
    },
    expected: true,
  },
  {
    name: 'valid XK sales export with tax',
    data: {
      voucherDate: '2026-07-01',
      description: 'Xuất kho bán hàng',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '632', entryType: 'DR', amount: 120000000 },
        { accountCode: '156', entryType: 'CR', amount: 120000000 },
        { accountCode: '131', entryType: 'DR', amount: 330000000 },
        { accountCode: '511', entryType: 'CR', amount: 300000000 },
        { accountCode: '3331', entryType: 'CR', amount: 30000000 },
      ],
    },
    expected: true,
  },

  // Invalid cases
  {
    name: 'negative amount inside details',
    data: {
      voucherDate: '2026-01-15',
      description: 'Số tiền âm',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: -500000 },
        { accountCode: '131', entryType: 'CR', amount: -500000 },
      ],
    },
    expected: false,
  },
  {
    name: 'less than 2 detail rows',
    data: {
      voucherDate: '2026-01-15',
      description: 'Thiếu dòng đối ứng',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 100000 },
      ],
    },
    expected: false,
  },
  {
    name: 'unbalanced DR/CR (DR > CR)',
    data: {
      voucherDate: '2026-01-15',
      description: 'Bất cân đối',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '152', entryType: 'DR', amount: 800000 },
        { accountCode: '1111', entryType: 'CR', amount: 700000 },
      ],
    },
    expected: false,
  },
  {
    name: 'unbalanced DR/CR (CR > DR)',
    data: {
      voucherDate: '2026-01-15',
      description: 'Bất cân đối',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 500000 },
        { accountCode: '331', entryType: 'CR', amount: 1000000 },
      ],
    },
    expected: false,
  },
  // Note: Zero amounts are allowed by the validator (amount >= 0).
  // Business logic should reject zero-amount vouchers at the service layer.
  {
    name: 'missing voucherDate',
    data: {
      description: 'Thiếu ngày',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    },
    expected: false,
  },
  {
    name: 'missing companyId',
    data: {
      voucherDate: '2026-01-15',
      description: 'Thiếu công ty',
      type: 'Thu',
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    },
    expected: false,
  },
  {
    name: 'invalid accountCode format',
    data: {
      voucherDate: '2026-01-15',
      description: 'Mã TK sai',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '', entryType: 'DR', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    },
    expected: false,
  },
  {
    name: 'invalid entryType value',
    data: {
      voucherDate: '2026-01-15',
      description: 'Loại định khoản sai',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'INVALID', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    },
    expected: false,
  },
];

// ─── Item Validation Data Table ───

const itemTestCases = [
  {
    name: 'valid item with all fields',
    data: { code: 'VT001', name: 'Vật tư A', unit: 'Cái', companyId: 1 },
    expected: true,
  },
  {
    name: 'valid item with optional fields',
    data: { code: 'VT002', name: 'Vật tư B', unit: 'Kg', companyId: 1, description: 'Mô tả' },
    expected: true,
  },
  {
    name: 'empty code',
    data: { code: '', name: 'Vật tư', unit: 'Cái', companyId: 1 },
    expected: false,
  },
  {
    name: 'missing name',
    data: { code: 'VT003', unit: 'Cái', companyId: 1 },
    expected: false,
  },
  {
    name: 'missing unit',
    data: { code: 'VT004', name: 'Vật tư', companyId: 1 },
    expected: false,
  },
  {
    name: 'missing companyId',
    data: { code: 'VT005', name: 'Vật tư', unit: 'Cái' },
    expected: false,
  },
];

// ─── User Registration Data Table ───

const registerTestCases = [
  {
    name: 'valid admin registration',
    data: { username: 'admin', password: 'password123' },
    expected: true,
  },
  {
    name: 'username too short (< 3 chars)',
    data: { username: 'ad', password: 'password123' },
    expected: false,
  },
  {
    name: 'password too short (< 6 chars)',
    data: { username: 'admin', password: '12345' },
    expected: false,
  },
  {
    name: 'empty username',
    data: { username: '', password: 'password123' },
    expected: false,
  },
  {
    name: 'empty password',
    data: { username: 'admin', password: '' },
    expected: false,
  },
];

// ─── Login Data Table ───

const loginTestCases = [
  {
    name: 'valid login credentials',
    data: { username: 'user', password: 'password' },
    expected: true,
  },
  {
    name: 'empty username',
    data: { username: '', password: 'password' },
    expected: false,
  },
  {
    name: 'empty password',
    data: { username: 'user', password: '' },
    expected: false,
  },
];

// ─── User Creation Data Table ───

const createUserCases = [
  {
    name: 'valid admin user',
    data: { username: 'newadmin', password: 'password123', role: 'admin' },
    expected: true,
  },
  {
    name: 'valid ktt user with companyIds',
    data: { username: 'kttuser', password: 'password123', role: 'ktt', companyIds: [1, 2, 3] },
    expected: true,
  },
  {
    name: 'valid nv_banhang user',
    data: { username: 'salesuser', password: 'password123', role: 'nv_banhang' },
    expected: true,
  },
  {
    name: 'valid nv_kho user',
    data: { username: 'warehouseuser', password: 'password123', role: 'nv_kho' },
    expected: true,
  },
  {
    name: 'invalid role',
    data: { username: 'baduser', password: 'password123', role: 'invalid' },
    expected: false,
  },
  {
    name: 'empty username',
    data: { username: '', password: 'password123', role: 'admin' },
    expected: false,
  },
  {
    name: 'short password',
    data: { username: 'newuser', password: '123', role: 'admin' },
    expected: false,
  },
];

// ─── Parameterized Tests ───

describe('Data-Driven: Voucher validation (createVoucherSchema)', () => {
  test.each(voucherTestCases)('[$expected] $name', ({ data, expected }) => {
    const result = createVoucherSchema.safeParse(data);
    expect(result.success).toBe(expected);
  });
});

describe('Data-Driven: Item validation (createItemSchema)', () => {
  test.each(itemTestCases)('[$expected] $name', ({ data, expected }) => {
    const result = createItemSchema.safeParse(data);
    expect(result.success).toBe(expected);
  });
});

describe('Data-Driven: Admin registration (registerAdminSchema)', () => {
  test.each(registerTestCases)('[$expected] $name', ({ data, expected }) => {
    const result = registerAdminSchema.safeParse(data);
    expect(result.success).toBe(expected);
  });
});

describe('Data-Driven: Login (loginSchema)', () => {
  test.each(loginTestCases)('[$expected] $name', ({ data, expected }) => {
    const result = loginSchema.safeParse(data);
    expect(result.success).toBe(expected);
  });
});

describe('Data-Driven: User creation (createUserSchema)', () => {
  test.each(createUserCases)('[$expected] $name', ({ data, expected }) => {
    const result = createUserSchema.safeParse(data);
    expect(result.success).toBe(expected);
  });
});

// ─── Performance: Bulk validation speed ───

describe('Performance: Bulk validation throughput', () => {
  const BUDGET_MS = 100; // must validate 1000 cases in under 100ms

  test(`createVoucherSchema validates 1000 variations in < ${BUDGET_MS}ms`, () => {
    const variations = Array.from({ length: 1000 }, (_, i) => ({
      voucherDate: '2026-01-15',
      description: `Performance test ${i}`,
      type: i % 2 === 0 ? 'Thu' : 'Chi',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    }));

    const start = performance.now();
    for (const v of variations) {
      createVoucherSchema.safeParse(v);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});