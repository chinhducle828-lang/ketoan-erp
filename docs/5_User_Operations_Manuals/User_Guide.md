# Hướng dẫn Sử dụng (User Guide)
## KETOAN ERP - Hệ thống Kế toán Doanh nghiệp

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Tổng quan Giao diện

### 1.1. Đăng nhập
1. Mở trình duyệt, truy cập URL của hệ thống
2. Nhập **Username** và **Password**
3. Nhấn **Đăng nhập**

> **Lưu ý**: Lần đăng nhập đầu tiên, hệ thống yêu cầu đổi mật khẩu.

### 1.2. Màn hình Chính
Sau khi đăng nhập, bạn sẽ thấy:
- **Sidebar** (trái): Danh sách module
- **Header** (trên): Thông tin người dùng, thông báo
- **Main Content** (giữa): Nội dung chính

### 1.3. Các Module Chính
| Module | Mô tả | Vai trò truy cập |
|--------|-------|-----------------|
| **Dashboard** | Tổng quan tài chính | Tất cả |
| **Chứng từ** | Quản lý phiếu thu/chi/nhập/xuất | nv, ktt, admin |
| **Sổ sách** | Sổ cái, sổ chi tiết | nv, ktt, admin |
| **Kho** | Nhập/xuất/tồn kho | nv_kho, admin |
| **Công nợ** | Phải thu, phải trả | nv, ktt |
| **Bán hàng** | Storefront POS | nv_banhang |
| **Báo cáo** | Báo cáo tài chính | ktt, gd_kinhdoanh, admin |
| **AI Copilot** | Trợ lý tài chính AI | Tất cả |
| **Quản trị** | Người dùng, công ty, cấu hình | admin |

---

## 2. Quản lý Chứng từ

### 2.1. Tạo Chứng từ Mới

**Các bước thực hiện:**
1. Vào module **Chứng từ** → **Tạo chứng từ**
2. Chọn **Loại chứng từ**: Phiếu thu (PT), Phiếu chi (PC), Phiếu nhập kho (NK), Phiếu xuất kho (XK)
3. Nhập các thông tin:
   - **Số chứng từ**: Tự động hoặc nhập tay
   - **Ngày chứng từ**: Mặc định là hôm nay
   - **Diễn giải**: Mô tả nội dung
   - **Loại tiền**: VND (mặc định)
4. Nhập chi tiết hạch toán:
   - **Tài khoản Nợ**: Chọn từ danh mục
   - **Tài khoản Có**: Chọn từ danh mục
   - **Số tiền**: Nhập số tiền
   - **Đối tượng**: Chọn khách hàng/nhà cung cấp (nếu cần)
   - **Hàng hóa**: Chọn hàng hóa (nếu là kho)
5. Nhấn **Lưu** (tạm) hoặc **Ghi sổ** (hạch toán ngay)

### 2.2. Gợi ý Tự động từ AI
Khi nhập diễn giải, AI Copilot tự động:
- **Gợi ý tài khoản** hạch toán phù hợp
- **Đề xuất đối tượng** liên quan
- **Kiểm tra cân đối** Nợ/Có
- **Cảnh báo** nếu số tiền lớn hơn ngưỡng

### 2.3. Duyệt và Ghi sổ
1. Vào **Chứng từ** → **Chờ duyệt**
2. Kiểm tra thông tin chứng từ
3. Nhấn **Duyệt** để ghi sổ
4. Sau khi ghi sổ, chứng từ không thể sửa/xóa

### 2.4. Tra cứu Chứng từ
- Tìm kiếm theo số chứng từ, diễn giải
- Lọc theo ngày, loại, trạng thái
- Xuất danh sách ra Excel

---

## 3. AI Financial Copilot

### 3.1. Đặt câu hỏi
1. Vào module **AI Copilot**
2. Nhập câu hỏi bằng tiếng Việt tự nhiên
3. Nhấn **Gửi**

**Ví dụ câu hỏi:**
- "Tổng doanh thu tháng này là bao nhiêu?"
- "Công nợ phải thu của khách hàng A là bao nhiêu?"
- "Lợi nhuận tháng trước so với tháng này thế nào?"
- "Hàng tồn kho nào đã lưu kho trên 90 ngày?"

### 3.2. Kết quả
AI Copilot trả về:
- **Câu trả lời** bằng tiếng Việt
- **Số liệu chi tiết**
- **Biểu đồ** (nếu phù hợp)
- **Mức độ tin cậy** (confidence score)

### 3.3. Xử lý OCR Hóa đơn
1. Vào module **AI OCR**
2. Upload hình ảnh hóa đơn (JPG, PNG, PDF)
3. AI tự động:
   - Nhận dạng thông tin hóa đơn
   - Trích xuất số hóa đơn, ngày, tiền
   - Đề xuất hạch toán
4. Kiểm tra và xác nhận kết quả

---

## 4. Quản lý Kho

### 4.1. Nhập kho
1. Vào **Kho** → **Nhập kho**
2. Chọn nhà cung cấp
3. Nhập danh sách hàng hóa: mã, số lượng, đơn giá
4. Hệ thống tự động:
   - Tính thành tiền
   - Cập nhật tồn kho
   - Sinh bút toán kế toán (Nợ 156/Có 331)
5. Nhấn **Lưu**

### 4.2. Xuất kho
1. Vào **Kho** → **Xuất kho**
2. Chọn khách hàng
3. Nhập danh sách hàng hóa
4. Hệ thống tự động:
   - Tính giá xuất (AVCO hoặc FIFO)
   - Cập nhật tồn kho
   - Sinh bút toán (Nợ 632/Có 156)
5. Nhấn **Lưu**

### 4.3. Kiểm kê kho
1. Vào **Kho** → **Kiểm kê**
2. Nhập số lượng thực tế
3. Hệ thống tự động so sánh với tồn kho hệ thống
4. Xử lý chênh lệch: điều chỉnh tăng/giảm

---

## 5. Storefront (Bán hàng)

### 5.1. Giao diện Bán hàng
1. Vào **Bán hàng**
2. Chọn sản phẩm từ danh sách
3. Nhập số lượng
4. Xem tổng tiền
5. Chọn phương thức thanh toán:
   - **Tiền mặt (COD)**
   - **Chuyển khoản**
6. Nhấn **Hoàn tất**

### 5.2. Quản lý Đơn hàng
- Xem danh sách đơn hàng
- Theo dõi trạng thái: pending → confirmed → delivering → delivered
- Hủy đơn hàng (nếu chưa giao)

---

## 6. Báo cáo

### 6.1. Báo cáo Tài chính
- **Bảng cân đối kế toán**: Tài sản = Nợ phải trả + Vốn chủ sở hữu
- **Báo cáo KQKD**: Doanh thu - Chi phí = Lợi nhuận
- **Báo cáo Lưu chuyển tiền tệ**: Dòng tiền thuần

### 6.2. Xuất báo cáo
1. Chọn loại báo cáo
2. Chọn kỳ (tháng, quý, năm)
3. Nhấn **Xem**
4. Nhấn **Xuất Excel** để tải file

---

## 7. Quản lý Công nợ

### 7.1. Theo dõi Công nợ
- **Phải thu**: Xem danh sách khách hàng còn nợ
- **Phải trả**: Xem danh sách nhà cung cấp cần thanh toán
- **Số dư**: Xem chi tiết số dư từng đối tượng

### 7.2. Đối chiếu Công nợ
1. Vào **Công nợ** → **Đối chiếu**
2. Chọn đối tượng
3. Hệ thống tự động đối chiếu chênh lệch
4. Xuất biên bản đối chiếu

---

## 8. Cấu hình Cá nhân

### 8.1. Đổi mật khẩu
1. Click vào tên người dùng (góc phải trên)
2. Chọn **Đổi mật khẩu**
3. Nhập mật khẩu cũ, mật khẩu mới
4. Nhấn **Lưu**

### 8.2. Tùy chỉnh Thông báo
1. Vào **Cài đặt** → **Thông báo**
2. Bật/tắt các loại thông báo:
   - Email
   - Push notification (trình duyệt)
   - Thông báo trong ứng dụng
3. Cài đặt giờ yên lặng (quiet hours)

---

## 9. Keyboard Shortcuts

| Phím tắt | Chức năng |
|---------|-----------|
| `Ctrl + N` | Tạo chứng từ mới |
| `Ctrl + S` | Lưu chứng từ |
| `Ctrl + F` | Tìm kiếm |
| `Ctrl + P` | In chứng từ |
| `Ctrl + E` | Xuất Excel |
| `Esc` | Đóng form |
| `F5` | Làm mới dữ liệu |
| `?` hoặc `F1` | Mở trợ giúp |

---

## 10. Mẹo & Thủ thuật

### 10.1. Nhập liệu Nhanh
- Sử dụng **AI Gợi ý** để tự động điền tài khoản
- **Copy chứng từ**: Nhân bản chứng từ cũ để tạo mới
- **Import Excel**: Nhập nhiều chứng từ từ file Excel

### 10.2. Bảo mật
- Đăng xuất khi không sử dụng
- Không chia sẻ mật khẩu
- Báo cáo ngay nếu phát hiện bất thường

### 10.3. Hỗ trợ
- **Hotline**: [Số điện thoại]
- **Email**: [Email support]
- **Tài liệu**: https://docs.ketoan-erp.com