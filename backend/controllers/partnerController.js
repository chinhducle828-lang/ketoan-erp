import * as partnerService from '../services/partnerService.js';

/**
 * Controller xử lý tạo mới Đối tác
 */
export const createPartner = async (req, res) => {
  try {
    // BẪY BẢO MẬT: Lấy company_id an toàn từ req.user (do authMiddleware giải mã token cung cấp)
    // Tuyệt đối không tin tưởng company_id do Client tự truyền lên ở body để chống hack chéo dữ liệu
    const { company_id } = req.user; 
    
    // Gom dữ liệu từ client gửi lên và gắn kèm company_id đã được xác thực
    const partnerData = { ...req.body, company_id };

    const newPartner = await partnerService.createPartnerDB(partnerData);
    
    return res.status(201).json({
      success: true,
      message: 'Thêm mới đối tác thành công!',
      data: newPartner
    });

  } catch (error) {
    // Bắt lỗi trùng mã đối tác (Mã lỗi 23505 là Constraint UNIQUE trong PostgreSQL)
    if (error.code === '23505') { 
      return res.status(400).json({
        success: false,
        message: 'Mã đối tác này đã tồn tại trong hệ thống của công ty.'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi hệ thống khi tạo đối tác: ' + error.message 
    });
  }
};

/**
 * Controller lấy danh sách đối tác thuộc công ty của người dùng
 */
export const getPartners = async (req, res) => {
  try {
    // Cô lập dữ liệu: Chỉ lấy các đối tác thuộc đúng công ty của user đang đăng nhập
    const { company_id } = req.user; 
    
    const partners = await partnerService.getPartnersByCompanyDB(company_id);
    
    return res.json({
      success: true,
      data: partners
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi hệ thống khi lấy danh sách đối tác: ' + error.message 
    });
  }
};