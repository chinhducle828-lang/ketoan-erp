const { describe, it, expect } = require('@jest/globals');
const {
  registerAdminSchema,
  loginSchema,
  createUserSchema,
  createVoucherSchema,
  createItemSchema,
} = require('../validators/index.js');

describe('Validators', () => {
  describe('registerAdminSchema', () => {
    it('should accept valid data', () => {
      const validData = {
        username: 'admin',
        password: 'password123',
      };
      const result = registerAdminSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject username shorter than 3 characters', () => {
      const invalidData = {
        username: 'ad',
        password: 'password123',
      };
      const result = registerAdminSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 6 characters', () => {
      const invalidData = {
        username: 'admin',
        password: '12345',
      };
      const result = registerAdminSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid data', () => {
      const validData = {
        username: 'user',
        password: 'password',
      };
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty username', () => {
      const invalidData = {
        username: '',
        password: 'password',
      };
      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    it('should accept valid admin user', () => {
      const validData = {
        username: 'newuser',
        password: 'password123',
        role: 'admin',
      };
      const result = createUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid ktt user with companyIds', () => {
      const validData = {
        username: 'kttuser',
        password: 'password123',
        role: 'ktt',
        companyIds: [1, 2, 3],
      };
      const result = createUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const invalidData = {
        username: 'user',
        password: 'password123',
        role: 'invalid',
      };
      const result = createUserSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createVoucherSchema', () => {
    it('should accept valid voucher data', () => {
      const validData = {
        voucherDate: '2026-01-15',
        description: 'Test voucher',
        accountDr: '1111',
        accountCr: '331',
        amount: 1000000,
        type: 'Thu',
        companyId: 1,
      };
      const result = createVoucherSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative amount', () => {
      const invalidData = {
        voucherDate: '2026-01-15',
        description: 'Test voucher',
        accountDr: '1111',
        accountCr: '331',
        amount: -1000,
        type: 'Thu',
        companyId: 1,
      };
      const result = createVoucherSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createItemSchema', () => {
    it('should accept valid item data', () => {
      const validData = {
        code: 'ITEM001',
        name: 'Test Item',
        unit: 'Cái',
        companyId: 1,
      };
      const result = createItemSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty code', () => {
      const invalidData = {
        code: '',
        name: 'Test Item',
        unit: 'Cái',
        companyId: 1,
      };
      const result = createItemSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});