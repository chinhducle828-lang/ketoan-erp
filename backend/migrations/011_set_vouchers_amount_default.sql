-- Đặt giá trị mặc định 0 cho cột amount trong bảng vouchers
-- Sửa lỗi: null value in column "amount" of relation "vouchers" violates not-null constraint
ALTER TABLE vouchers ALTER COLUMN amount SET DEFAULT 0;
-- Cập nhật các dòng hiện có có amount NULL thành 0
UPDATE vouchers SET amount = 0 WHERE amount IS NULL;