/**
 * Validator kiểm duyệt dữ liệu Đối tác đầu vào (Partners)
 * Chặn đứng: SQL Injection, dữ liệu rác, sai định dạng nghiệp vụ ERP
 */
export const validatePartner = (req, res, next) => {
  try {
    const { partner_code, partner_name, type, email, phone } = req.body;
    const errors = [];

    // 1. Kiểm tra Mã đối tác (Bắt buộc, không khoảng trống)
    if (!partner_code || typeof partner_code !== 'string' || partner_code.trim() === '') {
      errors.push('Mã đối tác không được để trống.');
    } else if (partner_code.length > 50) {
      errors.push('Mã đối tác không được dài quá 50 ký tự.');
    }

    // 2. Kiểm tra Tên đối tác (Bắt buộc)
    if (!partner_name || typeof partner_name !== 'string' || partner_name.trim() === '') {
      errors.push('Tên đối tác không được để trống.');
    } else if (partner_name.length > 255) {
      errors.push('Tên đối tác không được dài quá 255 ký tự.');
    }

    // 3. Kiểm tra Loại đối tác (Theo đúng ràng buộc CHECK của Database)
    const validTypes = ['customer', 'supplier', 'both'];
    if (!type || !validTypes.includes(type)) {
      errors.push('Loại đối tác không hợp lệ. Phải là: customer (Khách hàng), supplier (Nhà cung cấp) hoặc both (Cả hai).');
    }

    // 4. Kiểm tra Định dạng Email (Nếu người dùng có nhập)
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Định dạng Email không hợp lệ.');
      }
    }

    // 5. Kiểm tra Số điện thoại (Nếu có nhập)
    if (phone && phone.trim() !== '') {
      const phoneRegex = /^[0-9+\s-]{8,15}$/;
      if (!phoneRegex.test(phone)) {
        errors.push('Số điện thoại không hợp lệ (Chỉ chấp nhận số, dấu +, dấu - và từ 8-15 ký tự).');
      }
    }

    // --- KẾT LUẬN LỚP CHẶN ---
    // Nếu có bất kỳ lỗi nào, trả về trạng thái 400 Bad Request ngay lập tức
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ.',
        errors: errors
      });
    }

    // Dữ liệu sạch sẽ hoàn toàn -> Cho phép đi tiếp vào Controller
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi kiểm duyệt dữ liệu: ' + error.message
    });
  }
};