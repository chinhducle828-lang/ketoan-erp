import { z } from 'zod';

// Định nghĩa một helper để xử lý biến số có thể rỗng/null từ frontend gửi lên
const optionalNumericField = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? null : Number(val)),
  z.number().positive().nullable().optional()
);

// Auth validators
export const registerAdminSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
});

export const adminResetPasswordSchema = z.object({
  userId: z.number().positive('ID người dùng không hợp lệ'),
});

// User validators
export const createUserSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  role: z.enum(['admin', 'ktt', 'nv'], { required_error: 'Vui lòng chọn vai trò' }),
  companyIds: z.preprocess(
    (val) => (Array.isArray(val) ? val.map(Number).filter((n) => n > 0) : []),
    z.array(z.number().positive()).optional().default([])
  ),
  companyId: optionalNumericField,
  managerId: optionalNumericField,
});

export const assignStaffSchema = z.object({
  managerId: z.number().positive('ID Kế toán trưởng không hợp lệ'),
  staffIds: z.array(z.number().positive()).max(15, 'Một KTT chỉ quản lý tối đa 15 nhân viên'),
});

export const assignCompanySchema = z.object({
  userId: z.number().positive('ID người dùng không hợp lệ'),
  companyIds: z.preprocess(
    (val) => (Array.isArray(val) ? val.map(Number).filter((n) => n > 0) : []),
    z.array(z.number().positive()).optional().default([])
  ),
  companyId: optionalNumericField,
  role: z.enum(['admin', 'ktt', 'nv']).optional(),
  managerId: optionalNumericField,
});

// Company validators
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Tên công ty không được để trống'),
  taxCode: z.string().optional(),
  address: z.string().optional(),
});

// CHUẨN MỚI: Voucher validators (Cấu trúc Master-Detail)
export const createVoucherSchema = z.object({
  voucherDate: z.string().min(1, 'Ngày chứng từ không được để trống'),
  description: z.string().min(1, 'Diễn giải không được để trống'),
  type: z.string().min(1, 'Loại chứng từ không được để trống'),
  companyId: z.number().positive('Công ty không hợp lệ'),
  details: z.array(
    z.object({
      accountCode: z.string().min(1, 'Tài khoản không được để trống'),
      entryType: z.enum(['DR', 'CR'], { required_error: 'Bắt buộc chọn DR (Nợ) hoặc CR (Có)' }),
      amount: z.number().positive('Số tiền từng dòng phải lớn hơn 0')
    })
  ).min(2, 'Chứng từ phải có ít nhất 2 dòng hạch toán').refine((items) => {
    const drSum = items.filter(i => i.entryType === 'DR').reduce((sum, i) => sum + i.amount, 0);
    const crSum = items.filter(i => i.entryType === 'CR').reduce((sum, i) => sum + i.amount, 0);
    // Cho phép sai số rất nhỏ do kiểu float js (0.001)
    return Math.abs(drSum - crSum) < 0.01;
  }, { message: 'Tổng số tiền ghi Nợ phải bằng tổng số tiền ghi Có!' })
});

// Item validators
export const createItemSchema = z.object({
  code: z.string().min(1, 'Mã vật tư không được để trống'),
  name: z.string().min(1, 'Tên vật tư không được để trống'),
  unit: z.string().min(1, 'Đơn vị tính không được để trống'),
  companyId: z.number().positive('Công ty không hợp lệ'),
});

export const updateItemSchema = z.object({
  name: z.string().min(1, 'Tên vật tư không được để trống'),
  unit: z.string().min(1, 'Đơn vị tính không được để trống'),
});

// Opening balance validators
export const updateOpeningBalancesSchema = z.object({
  balances: z.record(z.object({
    dr: z.number().nonnegative(),
    cr: z.number().nonnegative(),
  })),
  year: z.number().int().positive().optional(),
  companyId: z.number().positive('Công ty không hợp lệ'),
});

// Query validators
export const companyIdQuerySchema = z.object({
  company_id: z.string().transform((val) => {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
      throw new Error('company_id không hợp lệ');
    }
    return num;
  }),
  year: z.string().transform((val) => Number(val)).optional(),
});