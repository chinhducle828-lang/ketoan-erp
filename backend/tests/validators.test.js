import { describe, it, expect } from '@jest/globals';
import {
  registerAdminSchema,
  loginSchema,
  createUserSchema,
  createVoucherSchema,
  createItemSchema,
} from '../validators/index.js';

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
    it('should accept valid multi-row voucher data with balanced DR/CR', () => {
      const validData = {
        voucherDate: '2026-01-15',
        description: 'Chi tiền mặt nhập kho vật tư công ty - Đa dòng',
        type: 'Chi',
        companyId: 1,
        // Dữ liệu chuẩn: Tổng Nợ (800k + 80k) === Tổng Có (880k)
        details: [
          { accountCode: '152', entryType: 'DR', amount: 800000 },
          { accountCode: '1331', entryType: 'DR', amount: 80000 },
          { accountCode: '1111', entryType: 'CR', amount: 880000 }
        ]
      };
      const result = createVoucherSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative amount inside details', () => {
      const invalidData = {
        voucherDate: '2026-01-15',
        description: 'Phiếu lỗi số tiền âm',
        type: 'Thu',
        companyId: 1,
        details: [
          { accountCode: '1111', entryType: 'DR', amount: -500000 },
          { accountCode: '131', entryType: 'CR', amount: -500000 }
        ]
      };
      const result = createVoucherSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject if details array has less than 2 rows', () => {
      const invalidData = {
        voucherDate: '2026-01-15',
        description: 'Phiếu thiếu dòng hạch toán đối ứng',
        type: 'Thu',
        companyId: 1,
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 } // Lỗi: Chỉ có 1 dòng
        ]
      };
      const result = createVoucherSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject if DR and CR are not balanced', () => {
      const invalidData = {
        voucherDate: '2026-01-15',
        description: 'Phiếu lỗi: Tổng Nợ không bằng Tổng Có',
        type: 'Thu',
        companyId: 1,
        details: [
          { accountCode: '152', entryType: 'DR', amount: 800000 }, // Nợ 800k
          { accountCode: '1111', entryType: 'CR', amount: 700000 } // Có 700k (Lệch)
        ]
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