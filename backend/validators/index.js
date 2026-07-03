// FILE_PATH: backend/validators/index.js
import { z } from 'zod';

// Helper xử lý định dạng số hoặc chuỗi số gửi từ Frontend (tránh lỗi chuỗi rỗng khi parse số)
const numericPreprocess = z.preprocess((val) => {
  if (val === '' || val === undefined || val === null) return null;
  const num = Number(val);
  return isNaN(num) ? val : num;
}, z.number().nullable().optional());

const strictPositiveNumeric = z.preprocess((val) => {
  if (val === '' || val === undefined || val === null) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, z.number().positive('Giá trị bắt buộc phải lớn hơn 0'));

// --- 1. AUTH VALIDATORS ---
export const registerAdminSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const adminResetPasswordSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  new_password: z.string().min(6).optional()
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui lòng nhập mật khẩu cũ'),
  old_password: z.string().optional(),
  newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  new_password: z.string().min(6).optional()
});

// --- 2. USER & STAFF VALIDATORS ---
export const createUserSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải từ 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự'),
  role: z.enum(['admin', 'ktt', 'nv', 'accountant'], { errorMap: () => ({ message: 'Vai trò không hợp lệ' }) }),
  companyIds: z.array(z.number().positive()).optional(),
  companyId: z.number().positive().optional(),
  managerId: z.number().positive().optional().nullable(),
  fiscal_year: z.number().int().min(2000).max(2100).optional()
});

// Note: updateUserSchema cannot use .partial() on schemas with .min()/.max() in Zod v4
export const updateUserSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải từ 3 ký tự').optional(),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự').optional(),
  role: z.enum(['admin', 'accountant'], { errorMap: () => ({ message: 'Vai trò không hợp lệ' }) }).optional(),
  fiscal_year: z.number().int().min(2000).max(2100).optional()
});

export const assignCompanySchema = z.object({
  userId: z.number().positive('ID người dùng không hợp lệ'),
  companyId: z.number().positive().optional().nullable(),
  companyIds: z.array(z.number().positive()).optional(),
  role: z.enum(['admin', 'ktt', 'nv']).optional(),
  managerId: z.number().positive().optional().nullable()
});

export const assignStaffSchema = z.object({
  user_id: z.number().positive('ID nhân viên không hợp lệ'),
  company_id: z.number().positive('ID công ty không hợp lệ'),
  permissions: z.array(z.string()).optional()
});

// --- 3. COMPANY VALIDATORS (Chuẩn snake_case khớp DB) ---
export const companiesSchema = z.object({
  name: z.string().min(1, 'Tên doanh nghiệp không được để trống'),
  tax_code: z.string().min(10, 'Mã số thuế phải từ 10-14 ký tự').max(14),
  address: z.string().optional().nullable(),
  lock_date: z.string().optional().nullable()
});

export const createCompanySchema = companiesSchema;
// Note: updateCompanySchema cannot use .partial() on schemas with .min()/.max() in Zod v4
export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Tên doanh nghiệp không được để trống').optional(),
  tax_code: z.string().min(10, 'Mã số thuế phải từ 10-14 ký tự').max(14).optional(),
  address: z.string().optional().nullable(),
  lock_date: z.string().optional().nullable()
});

// --- 4. PARTNER VALIDATORS ---
export const partnersSchema = z.object({
  company_id: z.number().positive('Thiếu thông tin ID công ty'),
  partner_code: z.string().min(1, 'Mã đối tác không được để trống'),
  partner_name: z.string().min(1, 'Tên đối tác không được để trống'),
  type: z.enum(['customer', 'vendor', 'both'], { errorMap: () => ({ message: 'Loại đối tác không hợp lệ' }) }),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email không đúng định dạng').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable()
});

export const createPartnerSchema = partnersSchema;
// Note: updatePartnerSchema cannot use .partial() on schemas with .email() in Zod v4
export const updatePartnerSchema = z.object({
  company_id: z.number().positive('Thiếu thông tin ID công ty').optional(),
  partner_code: z.string().min(1, 'Mã đối tác không được để trống').optional(),
  partner_name: z.string().min(1, 'Tên đối tác không được để trống').optional(),
  type: z.enum(['customer', 'vendor', 'both'], { errorMap: () => ({ message: 'Loại đối tác không hợp lệ' }) }).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email không đúng định dạng').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable()
});

// --- 5. INVENTORY ITEM VALIDATORS ---
export const createItemSchema = z.object({
  company_id: z.number().positive('Thiếu thông tin ID công ty'),
  item_code: z.string().min(1, 'Mã vật tư, hàng hóa không được để trống'),
  item_name: z.string().min(1, 'Tên vật tư, hàng hóa không được để trống'),
  unit: z.string().min(1, 'Đơn vị tính không được để trống'),
  safety_stock: numericPreprocess.default(0)
});

export const itemsSchema = createItemSchema;
// Note: updateItemSchema cannot use .partial() on schemas with .default() in Zod v4
export const updateItemSchema = z.object({
  company_id: z.number().positive('Thiếu thông tin ID công ty').optional(),
  item_code: z.string().min(1, 'Mã vật tư, hàng hóa không được để trống').optional(),
  item_name: z.string().min(1, 'Tên vật tư, hàng hóa không được để trống').optional(),
  unit: z.string().min(1, 'Đơn vị tính không được để trống').optional(),
  safety_stock: z.number().optional()
});

// --- 6. VOUCHER VALIDATORS (Bắt buộc nguyên tắc cân đối kế toán Tổng Nợ = Tổng Có) ---
export const createVoucherSchema = z.object({
  company_id: z.number().positive('Công ty không hợp lệ'),
  voucher_number: z.string().min(1, 'Số chứng từ không được để trống'),
  voucher_date: z.string().min(1, 'Ngày hạch toán không được để trống'),
  voucher_type: z.enum(['NK', 'PT', 'PC', 'PN', 'PX']),
  description: z.string().optional().nullable(),
  details: z.array(
    z.object({
      account_code: z.string().min(1, 'Tài khoản không được để trống'),
      entry_type: z.enum(['DR', 'CR']),
      amount: strictPositiveNumeric,
      partner_id: z.number().positive().optional().nullable(),
      item_id: z.number().positive().optional().nullable(),
      quantity: numericPreprocess,
      price: numericPreprocess
    })
  ).min(2, 'Chứng từ phải có tối thiểu 2 dòng định khoản')
}).refine((data) => {
  const drSum = data.details.filter(i => i.entry_type === 'DR').reduce((sum, i) => sum + i.amount, 0);
  const crSum = data.details.filter(i => i.entry_type === 'CR').reduce((sum, i) => sum + i.amount, 0);
  return Math.abs(drSum - crSum) < 0.01;
}, { 
  message: 'Lỗi hạch toán bất cân đối: Tổng số tiền ghi Nợ phải bằng tổng số tiền ghi Có!',
  path: ['details']
});

export const vouchersSchema = createVoucherSchema;
// Note: updateVoucherSchema cannot use .partial() on schemas with .refine() in Zod v4
// Create a separate schema for updates without the refinement
export const updateVoucherSchema = z.object({
  company_id: z.number().positive('Công ty không hợp lệ').optional(),
  voucher_number: z.string().min(1, 'Số chứng từ không được để trống').optional(),
  voucher_date: z.string().min(1, 'Ngày hạch toán không được để trống').optional(),
  voucher_type: z.enum(['NK', 'PT', 'PC', 'PN', 'PX']).optional(),
  description: z.string().optional().nullable(),
  details: z.array(
    z.object({
      account_code: z.string().min(1, 'Tài khoản không được để trống'),
      entry_type: z.enum(['DR', 'CR']),
      amount: z.number().optional(),
      partner_id: z.number().positive().optional().nullable(),
      item_id: z.number().positive().optional().nullable(),
      quantity: z.number().optional(),
      price: z.number().optional()
    })
  ).min(2, 'Chứng từ phải có tối thiểu 2 dòng định khoản').optional()
});

// --- 7. ACCOUNT VALIDATORS ---
export const createAccountSchema = z.object({
  company_id: z.number().positive('Công ty không hợp lệ'),
  account_code: z.string().min(3, 'Mã tài khoản phải từ 3 ký tự trở lên'),
  account_name: z.string().min(1, 'Tên tài khoản không được để trống'),
  parent_code: z.string().optional().nullable(),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'])
});

export const accountsSchema = createAccountSchema;
// Note: updateAccountSchema cannot use .partial() on schemas with .min() in Zod v4
export const updateAccountSchema = z.object({
  company_id: z.number().positive('Công ty không hợp lệ').optional(),
  account_code: z.string().min(3, 'Mã tài khoản phải từ 3 ký tự trở lên').optional(),
  account_name: z.string().min(1, 'Tên tài khoản không được để trống').optional(),
  parent_code: z.string().optional().nullable(),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional()
});
