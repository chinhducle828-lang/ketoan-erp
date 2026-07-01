import { z } from 'zod';

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
  companyIds: z.array(z.number().positive()).optional(),
  companyId: z.number().positive().optional(),
  managerId: z.number().positive().optional().nullable(),
});

export const assignStaffSchema = z.object({
  managerId: z.number().positive('ID Kế toán trưởng không hợp lệ'),
  staffIds: z.array(z.number().positive()).max(15, 'Một KTT chỉ quản lý tối đa 15 nhân viên'),
});

export const assignCompanySchema = z.object({
  userId: z.number().positive('ID người dùng không hợp lệ'),
  companyIds: z.array(z.number().positive()).optional(),
  companyId: z.number().positive().optional(),
  role: z.enum(['admin', 'ktt', 'nv']).optional(),
  managerId: z.number().positive().optional().nullable(),
});

// Company validators
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Tên công ty không được để trống'),
  taxCode: z.string().optional(),
  address: z.string().optional(),
});

// Voucher validators
export const createVoucherSchema = z.object({
  voucherDate: z.string().min(1, 'Ngày chứng từ không được để trống'),
  description: z.string().min(1, 'Diễn giải không được để trống'),
  accountDr: z.string().min(1, 'Tài khoản nợ không được để trống'),
  accountCr: z.string().min(1, 'Tài khoản có không được để trống'),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  type: z.string().min(1, 'Loại chứng từ không được để trống'),
  companyId: z.number().positive('Công ty không hợp lệ'),
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

// Middleware kiểm tra dữ liệu bằng Zod
export const validate = (schema) => async (req, res, next) => {
  try {
    // Kiểm tra dữ liệu được gửi lên trong body, query hoặc params
    await schema.parseAsync(req.body);
    return next(); // Nếu dữ liệu chuẩn, cho phép request đi tiếp vào controller
  } catch (error) {
    // Nếu dữ liệu vi phạm schema (thiếu trường, sai kiểu), trả về lỗi 400 và chi tiết
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message, // Lấy câu thông báo lỗi đầu tiên bằng tiếng Việt
        errors: error.errors
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu đầu vào không hợp lệ'
    });
  }
};