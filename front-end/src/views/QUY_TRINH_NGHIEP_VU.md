# TỔNG HỢP QUY TRÌNH NGHIỆP VỤ KẾ TOÁN
## Hệ Thống ERP Kế Toán Doanh Nghiệp

---

## MỤC LỤC

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Quy Trình Quỹ & Tiền Gửi Ngân Hàng](#2-quy-trình-quỹ--tiền-gửi-ngân-hàng)
3. [Quy Trình Mua Hàng & Nhập Kho](#3-quy-trình-mua-hàng--nhập-kho)
4. [Quy Trình Bán Hàng & Doanh Thu](#4-quy-trình-bán-hàng--doanh-thu)
5. [Quy Trình Quản Lý Đối Tác](#5-quy-trình-quản-lý-đối-tác)
6. [Quy Trình Tính Lương & Trích Bảo Hiểm](#6-quy-trình-tính-lương--trích-bảo-hiểm)
7. [Quy Trình Báo Cáo Thuế](#7-quy-trình-báo-cáo-thuế)
8. [Quy Trình Báo Cáo Tài Chính](#8-quy-trình-báo-cáo-tài-chính)
9. [Quy Trình Kết Chuyển Khóa Sổ Cuối Kỳ](#9-quy-trình-kết-chuyển-khóa-sổ-cuối-kỳ)
10. [Quy Trình Quản Lý Tài Sản Cố Định](#10-quy-trình-quản-lý-tài-sản-cố-định)
11. [Quy Trình Tập Hợp Chi Phí Giá Thành](#11-quy-trình-tập-hợp-chi-phí-giá-thành)
12. [Quy Trình Quản Lý Chứng Từ Tổng Hợp](#12-quy-trình-quản-lý-chứng-từ-tổng-hợp)
13. [Quy Trình Quản Lý Kho Tổng Hợp](#13-quy-trình-quản-lý-kho-tổng-hợp)
14. [Quy Trình Dashboard Dòng Tiền](#14-quy-trình-dashboard-dòng-tiền)
15. [Quy Trình Logistics & Giao Hàng](#15-quy-trình-logistics--giao-hàng)
16. [Phân Quyền & Bảo Mật Hệ Thống](#16-phân-quyền--bảo-mật-hệ-thống)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1. Giới Thiệu
Hệ thống ERP Kế Toán là giải pháp quản lý tài chính toàn diện được thiết kế theo Thông tư 99/2025/TT-BTC, cung cấp các chức năng từ quản lý quỹ, mua hàng, bán hàng, báo cáo thuế đến khóa sổ cuối kỳ.

### 1.2. Các Module Chính
Hệ thống bao gồm 22 module chức năng chính:

**Module Quản Lý Tài Chính:**
- Quỹ & Tiền gửi ngân hàng (Cash Management)
- Báo cáo Kết quả hoạt động kinh doanh
- Báo cáo Tài chính B01-DN (Bảng Cân đối kế toán)
- Báo cáo Lưu chuyển tiền tệ B03-DN
- Bản thuyết minh BCTC B09-DN
- Dashboard dòng tiền

**Module Nghiệp Vụ:**
- Mua hàng & Vật tư nhập kho
- Bán hàng tại quầy (POS)
- Hóa đơn bán hàng Excel
- Quản lý Đối tác (KH & NCC)
- Quản lý Chứng từ Tổng hợp
- Quản lý Kho Tổng hợp

**Module Nhân Sự & Chi Phí:**
- Tính lương & Trích BHXH
- Tập hợp chi phí Giá thành
- Tài sản cố định & Khấu hao

**Module Thuế & Báo Cáo:**
- Tờ khai báo cáo Thuế GTGT
- Kết chuyển khóa sổ cuối kỳ
- Khai báo số dư đầu kỳ

**Module Hệ Thống:**
- Cấu hình pháp nhân (Quản lý công ty)
- Nhật ký an ninh & hệ thống
- Logistics / Giao hàng
- Màn hình Bãi xúc

### 1.3. Đối Tượng Sử Dụng
- **Admin**: Quyền truy cập toàn bộ hệ thống
- **KTT (Kế Toán Trưởng)**: Quản lý tài chính, báo cáo, khóa sổ
- **NV (Nhân Viên)**: Nhập liệu, theo dõi nghiệp vụ
- **GD Kinh Doanh**: Xem báo cáo kinh doanh, chi phí

---

## 2. QUY TRÌNH QUỸ & TIỀN GỬI NGÂN HÀNG

### 2.1. Mô Tả Module
Module Quản lý Quỹ & Tiền gửi ngân hàng cho phép ghi nhận các nghiệp vụ thu tiền (Phiếu Thu - PT) và chi tiền (Phiếu Chi - PC) với hỗ trợ đa tiền tệ.

### 2.2. Chức Năng Chính

#### 2.2.1. Tạo Phiếu Thu (PT)
**Mục đích:** Ghi nhận các khoản thu tiền mặt, chuyển khoản từ khách hàng hoặc các đối tác khác.

**Quy trình:**
1. **Chuẩn bị thông tin:**
   - Ngày chứng từ (mặc định: ngày hiện tại)
   - Chọn đối tác công nợ (từ danh mục đối tác)
   - Loại tiền tệ (VND, USD, EUR)
   - Tỷ giá hạch toán (tự động điền 1 với VND)
   - Lý do nộp/nội dung chi

2. **Định khoản:**
   - Chọn loại bút toán: NỢ (DR) hoặc CÓ (CR)
   - Nhập mã tài khoản (ví dụ: 1111 - Tiền mặt, 131 - Phải thu khách hàng)
   - Nhập số tiền nguyên tệ
   - Hệ thống tự động quy đổi sang VND theo tỷ giá

3. **Kiểm tra và ghi sổ:**
   - Hệ thống kiểm tra cân đối Nợ = Có
   - Tạo số phiếu tự động: PT-XXXXXX
   - Lưu chứng từ vào hệ thống

**Định khoản mẫu Phiếu Thu:**
```
Nợ TK 1111/112 (Tiền mặt/Tiền gửi ngân hàng)
   Có TK 131 (Phải thu khách hàng) hoặc TK 511 (Doanh thu)
```

#### 2.2.2. Tạo Phiếu Chi (PC)
**Mục đích:** Ghi nhận các khoản chi tiền mặt, chuyển khoản cho nhà cung cấp, chi phí nội bộ.

**Quy trình:**
1. **Chuẩn bị thông tin:**
   - Ngày chứng từ
   - Chọn đối tác công nợ (NCC)
   - Loại tiền tệ và tỷ giá
   - Lý do chi/nội dung

2. **Định khoản:**
   - Xác định tài khoản Nợ (chi phí, tài sản)
   - Xác định tài khoản Có (tiền mặt, tiền gửi)
   - Nhập số tiền

3. **Kiểm tra và ghi sổ:**
   - Kiểm tra cân đối Nợ = Có
   - Tạo số phiếu: PC-XXXXXX
   - Lưu vào hệ thống

**Định khoản mẫu Phiếu Chi:**
```
Nợ TK 632 (Chi phí) hoặc TK 156 (Hàng hóa)
   Có TK 1111/112 (Tiền mặt/Tiền gửi NH)
```

### 2.3. Tính Năng Đặc Biệt
- **Hỗ trợ đa tiền tệ:** VND, USD, EUR với tỷ giá hạch toán linh hoạt
- **Tự động quy đổi:** Số tiền nguyên tệ tự động nhân với tỷ giá → VND
- **Kiểm tra cân đối:** Không cho phép ghi sổ nếu Tổng Nợ ≠ Tổng Có
- **Liên kết đối tác:** Tích hợp với danh mục đối tác (KH/NCC)

### 2.4. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 3. QUY TRÌNH MUA HÀNG & NHẬP KHO

### 3.1. Mô Tả Module
Module Mua hàng & Vật tư nhập kho hỗ trợ ghi nhận nghiệp vụ mua hàng hóa, vật tư, nguyên liệu với tự động tính thuế GTGT và định khoản theo chuẩn mực kế toán Việt Nam.

### 3.2. Chức Năng Chính

#### 3.2.1. Nhập Kho Mua Hàng Nhanh
**Mục đích:** Ghi nhận nghiệp vụ mua hàng hóa, vật tư nhập kho với đầy đủ thông tin thuế.

**Quy trình:**
1. **Nhập thông tin hàng hóa:**
   - Mô tả vật tư/hàng hóa
   - Giá trị trước thuế (VND)
   - Thuế suất GTGT (0%, 5%, 10%)

2. **Tự động tính toán:**
   - Tiền hàng: Giá trị nhập
   - Thuế GTGT: Giá trị × Thuế suất
   - Tổng phải trả: Tiền hàng + Thuế

3. **Định khoản tự động:**
```
Nợ TK 156 (Hàng hóa kho tổng) - Giá trị hàng
Nợ TK 1331 (Thuế GTGT được khấu trừ) - Thuế GTGT
   Có TK 331 (Phải trả người bán) - Tổng cộng
```

4. **Ghi sổ:**
   - Tạo chứng từ tự động: NK-XXXXXX (Phiếu Nhập Kho)
   - Lưu vào hệ thống với đầy đủ chi tiết định khoản

### 3.3. Tính Năng Đặc Biệt
- **Tự động tính thuế:** Hệ thống tự động tính thuế GTGT theo thuế suất
- **Định khoản chuẩn:** Tự động sinh bút toán theo chuẩn TT99
- **Kiểm tra hợp lệ:** Bắt buộc nhập tên hàng và giá trị > 0
- **Tích hợp kho:** Liên kết với module quản lý kho tổng hợp

### 3.4. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 4. QUY TRÌNH BÁN HÀNG & DOANH THU

### 4.1. Mô Tả Module
Module Bán hàng hỗ trợ ghi nhận doanh thu từ bán hàng tại quầy (POS) và đồng bộ doanh thu từ file Excel, với tự động định khoản theo chuẩn mực kế toán.

### 4.2. Chức Năng Chính

#### 4.2.1. Bán Hàng Tại Quầy (POS)
**Mục đích:** Ghi nhận doanh thu bán hàng trực tiếp tại quầy.

**Đặc điểm:**
- Chỉ dành cho Admin trong hệ thống ERP
- Tích hợp với thiết bị POS
- Tự động tạo chứng từ bán hàng

#### 4.2.2. Đồng Bộ Doanh Thu Từ Excel
**Mục đích:** Nhập khối lượng lớn hóa đơn bán hàng từ file Excel để ghi sổ hàng loạt.

**Quy trình:**
1. **Upload file Excel:**
   - Định dạng: .xlsx, .xls
   - Cấu trúc file: ID, Customer, Amount, TaxRate
   - Hệ thống đọc và parse dữ liệu

2. **Kiểm tra dữ liệu:**
   - Lọc các hóa đơn hợp lệ (Amount > 0)
   - Hiển thị số lượng hóa đơn đã đọc

3. **Định khoản tự động cho mỗi hóa đơn:**
```
Nợ TK 131 (Phải thu khách hàng) - Tiền hàng + Thuế
   Có TK 511 (Doanh thu bán hàng) - Tiền hàng
   Có TK 3331 (Thuế GTGT đầu ra) - Thuế GTGT
```

4. **Ghi sổ hàng loạt:**
   - Tạo chứng từ: PK-XXXXXX (Phiếu Khác) cho mỗi hóa đơn
   - Đồng bộ toàn bộ vào hệ thống
   - Thông báo kết quả

**Ví dụ định khoản:**
- Hóa đơn: 10,000,000đ, thuế 10%
- Tiền hàng: 10,000,000đ
- Thuế GTGT: 1,000,000đ
- Tổng phải thu: 11,000,000đ

```
Nợ TK 131: 11,000,000đ
   Có TK 511: 10,000,000đ
   Có TK 3331: 1,000,000đ
```

### 4.3. Tính Năng Đặc Biệt
- **Import hàng loạt:** Xử lý hàng trăm hóa đơn cùng lúc
- **Tự động nhận diện:** Đọc cấu trúc Excel linh hoạt (ID, Customer, Amount, TaxRate)
- **Định khoản chuẩn:** Tự động sinh bút toán theo TT99
- **Báo cáo tiến độ:** Hiển thị số hóa đơn đã xử lý

### 4.4. Phân Quyền
- **Bán hàng tại quầy:** Chỉ Admin
- **Hóa đơn Excel:** Chỉ Admin

---

## 5. QUY TRÌNH QUẢN LÝ ĐỐI TÁC

### 5.1. Mô Tả Module
Module Quản lý Đối tác (Danh mục KH & NCC) cho phép đăng ký, quản lý thông tin khách hàng và nhà cung cấp với phân loại rõ ràng theo tính chất công nợ.

### 5.2. Chức Năng Chính

#### 5.2.1. Đăng Ký Đối Tác Mới
**Mục đích:** Tạo mới đối tác trong hệ thống để sử dụng cho các nghiệp vụ phát sinh sau.

**Quy trình:**
1. **Nhập thông tin cơ bản:**
   - Mã đối tác (Mã KH/NCC) - Bắt buộc, duy nhất
   - Tên đối tác doanh nghiệp - Bắt buộc
   - Loại đối tác:
     * Khách hàng (TK 131 - Phải thu)
     * Nhà cung cấp (TK 331 - Phải trả)
     * Lưỡng tính (Cả KH và NCC)

2. **Thông tin bổ sung:**
   - Số điện thoại
   - Email
   - Địa chỉ

3. **Lưu vào hệ thống:**
   - Kiểm tra mã đối tác không trùng lặp
   - Lưu vào danh mục theo công ty đang active

### 5.3. Phân Loại Đối Tác

#### 5.3.1. Khách Hàng (Customer)
- **Tài khoản mặc định:** 131 - Phải thu của khách hàng
- **Nghiệp vụ liên quan:** Bán hàng, thu tiền, giảm trừ công nợ
- **Bút toán điển hình:**
  - Bán hàng: Nợ 131 / Có 511, 3331
  - Thu tiền: Nợ 111/112 / Có 131

#### 5.3.2. Nhà Cung Cấp (Vendor)
- **Tài khoản mặc định:** 331 - Phải trả cho người bán
- **Nghiệp vụ liên quan:** Mua hàng, nhập kho, thanh toán
- **Bút toán điển hình:**
  - Mua hàng: Nợ 156, 1331 / Có 331
  - Thanh toán: Nợ 331 / Có 111/112

#### 5.3.3. Lưỡng Tính (Both)
- **Tính chất:** Vừa là khách hàng vừa là nhà cung cấp
- **Ứng dụng:** Doanh nghiệp có cả hoạt động mua và bán với cùng đối tác
- **Tài khoản:** Cả 131 và 331

### 5.4. Tính Năng Đặc Biệt
- **Mã duy nhất:** Đảm bảo không trùng lặp mã đối tác
- **Phân loại rõ ràng:** Xác định tính chất công nợ ngay từ đầu
- **Tích hợp đa module:** Sử dụng được trong Quỹ, Mua hàng, Bán hàng
- **Theo dõi công ty:** Mỗi đối tác thuộc về một công ty cụ thể

### 5.5. Phân Quyền
- **Admin, KTT, NV:** Được phép quản lý đối tác

---

## 6. QUY TRÌNH TÍNH LƯƠNG & TRÍCH BẢO HIỂM

### 6.1. Mô Tả Module
Module Tính lương & Trích BHXH thực hiện hạch toán tổng hợp chi phí tiền lương, thuế TNCN và các khoản trích bảo hiểm bắt buộc theo quy định pháp luật.

### 6.2. Chức Năng Chính

#### 6.2.1. Hạch Toán Lương Tổng Hợp
**Mục đích:** Tự động sinh bút toán kép tích hợp cho toàn bộ chi phí lương, bảo hiểm và thuế TNCN.

**Quy trình:**
1. **Nhập thông tin:**
   - Tổng quỹ lương gộp (Gross Salary)
   - Tổng thuế TNCN khấu trừ (nếu có)

2. **Tự động tính toán các khoản:**
   - **Bảo hiểm doanh nghiệp chịu:** 21.5% × Lương gộp
   - **Bảo hiểm người lao động chịu:** 10.5% × Lương gộp
   - **BHXH tổng:** 25.5% (DN 17.5% + NLĐ 8%)
   - **BHYT tổng:** 4.5% (DN 3% + NLĐ 1.5%)
   - **BHTN tổng:** 2% (DN 1% + NLĐ 1%)

3. **Sinh bút toán tự động (7 dòng):**

**Dòng 1-2: Hạch toán lương gộp**
```
Nợ TK 6422 (Chi phí QLDN) - Lương gộp
   Có TK 334 (Phải trả NLĐ) - Lương gộp
```

**Dòng 3-4: Khấu trừ thuế TNCN**
```
Nợ TK 334 (Phải trả NLĐ) - Thuế TNCN
   Có TK 3331 (Thuế TNCN phải nộp) - Thuế TNCN
```

**Dòng 5-7: Trích bảo hiểm**
```
Nợ TK 6422 (Chi phí QLDN) - BH DN chịu
Nợ TK 334 (Phải trả NLĐ) - BH NLĐ chịu
   Có TK 3383 (Nghĩa vụ BHXH) - Tổng BHXH
   Có TK 3384 (Nghĩa vụ BHYT) - Tổng BHYT
   Có TK 3386 (Nghĩa vụ BHTN) - Tổng BHTN
```

4. **Ghi sổ:**
   - Tạo chứng từ: TL-XXXXXX (Tiền Lương)
   - Ngày chứng từ: Ngày cuối tháng
   - Lưu mô tả đầy đủ: Tháng/Năm

### 6.3. Cấu Trúc Định Khoản Chi Tiết

#### 6.3.1. Chi Phí Lương Gộp
- **TK Nợ:** 6422 - Chi phí quản lý doanh nghiệp
- **TK Có:** 334 - Phải trả người lao động
- **Số tiền:** Tổng quỹ lương gộp

#### 6.3.2. Thuế TNCN
- **TK Nợ:** 334 - Khấu trừ từ lương NLĐ
- **TK Có:** 3331 - Thuế TNCN phải nộp NSNN
- **Số tiền:** Tổng thuế TNCN đã khấu trừ

#### 6.3.3. Bảo Hiểm Xã Hội (BHXH)
- **Tỷ lệ tổng:** 25.5% (DN 17.5% + NLĐ 8%)
- **TK Nợ:** 6422 (phần DN) + 334 (phần NLĐ)
- **TK Có:** 3383 - Nghĩa vụ BHXH

#### 6.3.4. Bảo Hiểm Y Tế (BHYT)
- **Tỷ lệ tổng:** 4.5% (DN 3% + NLĐ 1.5%)
- **TK Nợ:** 6422 (phần DN) + 334 (phần NLĐ)
- **TK Có:** 3384 - Nghĩa vụ BHYT

#### 6.3.5. Bảo Hiểm Thất Nghiệp (BHTN)
- **Tỷ lệ tổng:** 2% (DN 1% + NLĐ 1%)
- **TK Nợ:** 6422 (phần DN) + 334 (phần NLĐ)
- **TK Có:** 3386 - Nghĩa vụ BHTN

### 6.4. Tính Năng Đặc Biệt
- **Định khoản kép tích hợp:** 7 dòng bút toán tự động cân đối
- **Tính toán tự động:** Tỷ lệ bảo hiểm theo quy định pháp luật
- **Lưu trữ:** Sử dụng persistent state để lưu form
- **Xuất Excel:** Xuất bảng trích lương và bảo hiểm

### 6.5. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 7. QUY TRÌNH BÁO CÁO THUẾ

### 7.1. Mô Tả Module
Module Báo cáo Thuế tổng hợp và phân tích các loại thuế phát sinh trong kỳ kế toán: Thuế GTGT, Thuế TNDN, Thuế TNCN theo Thông tư 99/2025/TT-BTC.

### 7.2. Chức Năng Chính

#### 7.2.1. Báo Cáo Thuế GTGT (Mẫu 01/GTGT)
**Mục đích:** Tổng hợp thuế GTGT đầu vào và đầu ra để xác định nghĩa vụ thuế phải nộp.

**Cấu trúc báo cáo:**
1. **Thuế GTGT đầu vào (TK 1331 - Nợ):**
   - Thuế GTGT được khấu trừ từ hóa đơn mua hàng
   - Tổng hợp từ các chứng từ nhập kho, mua hàng
   - Phát sinh bên Nợ TK 1331

2. **Thuế GTGT đầu ra (TK 3331 - Có):**
   - Thuế GTGT tính trên doanh thu bán hàng
   - Tổng hợp từ các chứng từ bán hàng
   - Phát sinh bên Có TK 3331

3. **Nghĩa vụ phải nộp:**
   - Công thức: Thuế đầu ra - Thuế đầu vào
   - Nếu > 0: Phải nộp thêm
   - Nếu < 0: Được khấu trừ chuyển kỳ sau

**Ví dụ:**
- Thuế đầu vào: 5,000,000đ
- Thuế đầu ra: 8,000,000đ
- **Nghĩa vụ phải nộp: 3,000,000đ**

#### 7.2.2. Báo Cáo Thuế TNDN (TK 3334)
**Mục đích:** Theo dõi phát sinh và thanh toán thuế thu nhập doanh nghiệp.

**Cấu trúc theo dõi lưỡng tính:**
1. **Phát sinh nghĩa vụ (Có TK 3334):**
   - Từ báo cáo KQKD (TK 821)
   - Thuế TNDN phải nộp theo quy định

2. **Đã nộp thuế (Nợ TK 3334):**
   - Từ chứng từ thuế (Phiếu thu, ủy nhiệm chi)
   - Tạm nộp, nộp thừa

3. **Trạng thái nghĩa vụ:**
   - Còn phải nộp: Phát sinh - Đã nộp
   - Tạm nộp thừa: Đã nộp - Phát sinh (Dư Nợ)

**Ví dụ:**
- Thuế TNDN phát sinh: 15,000,000đ
- Đã nộp: 12,000,000đ
- **Còn phải nộp: 3,000,000đ**

#### 7.2.3. Báo Cáo Thuế TNCN (TK 3335)
**Mục đích:** Theo dõi thuế TNCN khấu trừ tại nguồn từ người lao động.

**Cấu trúc:**
- **Phát sinh (Có TK 3335):** Từ bảng lương (Payroll)
- **Tổng khấu trừ:** Tổng thuế TNCN đã trừ vào lương NLĐ
- **Trạng thái:** Chờ quyết toán chuyển nộp NSNN

### 7.3. Tính Năng Đặc Biệt
- **Tự động tổng hợp:** Đọc toàn bộ chứng từ, bóc tách theo tài khoản
- **Hỗ trợ ghi đỏ:** Xử lý số âm cho điều chỉnh tăng/giảm
- **Theo dõi lưỡng tính:** Thuế TNDN theo dõi cả phát sinh và đã nộp
- **Xuất Excel:** Xuất báo cáo thuế ra file Excel
- **Thông tin niên độ:** Hiển thị năm kế toán hiện tại

### 7.4. Phân Quyền
- **Admin, KTT, GD Kinh Doanh:** Được xem báo cáo thuế

---

## 8. QUY TRÌNH BÁO CÁO TÀI CHÍNH

### 8.1. Mô Tả Module
Module Báo cáo Tài chính cung cấp các báo cáo theo Thông tư 99/2025/TT-BTC: Báo cáo KQKD, Bảng Cân đối kế toán, Báo cáo Lưu chuyển tiền tệ, Bản thuyết minh BCTC.

### 8.2. Chức Năng Chính

#### 8.2.1. Báo Cáo Kết Quả Hoạt Động Kinh Doanh
**Mục đích:** Thể hiện tình hình tài chính, kết quả kinh doanh của doanh nghiệp trong kỳ.

**Cấu trúc báo cáo (8 chỉ tiêu chính):**

**I. Doanh Thu Thuần (TK 511)**
- Doanh thu bán hàng và cung cấp dịch vụ
- Tổng hợp bên Có TK 511

**II. Giá Vốn Hàng Bán (TK 632)**
- Chi phí giá vốn hàng bán
- Tổng hợp bên Nợ TK 632

**III. Lợi Nhuận Gộp**
- Công thức: I - II
- Đánh giá hiệu quả bán hàng cơ bản

**IV. Chi Phí Hoạt Động**
- Doanh thu hoạt động tài chính (TK 515)
- Chi phí tài chính (TK 635)
- Chi phí bán hàng (TK 641)
- Chi phí quản lý doanh nghiệp (TK 642)

**V. Lợi Nhuận Thuần Từ HĐKD**
- Công thức: III + 515 - (635 + 641 + 642)

**VI. Thu Nhập & Chi Phí Khác**
- Thu nhập khác (TK 711)
- Chi phí khác (TK 811)

**VII. Lợi Nhuận Trước Thuế**
- Công thức: V + (711 - 811)

**VIII. Chi Phí Thuế TNDN (TK 821)**
- Thuế TNDN hiện hành

**LNST (Lợi Nhuận Sau Thuế)**
- Công thức: VII - 821
- Đánh giá: Hoạt động có lãi hay lỗ ròng

**Tính năng đặc biệt:**
- **Thuế suất lũy tiến:** Tự động tính theo doanh thu năm trước
  - ≤ 3 tỷ: 15%
  - ≤ 50 tỷ: 17%
  - > 50 tỷ: 20%
- **Chỉ số niên độ:** Chọn năm kế toán để xem báo cáo
- **So sánh năm:** Nhập doanh thu năm trước để tính thuế suất

#### 8.2.2. 9 Chu Trình Nghiệp Vụ
**Mục đích:** Phân tích chi tiết các chu trình nghiệp vụ phát sinh trong kỳ.

**9 Chu trình:**
1. **Chu trình 1:** Vốn chủ sở hữu, mua TSCĐ, vay nợ (TK 411, 121, 128, 221, 515)
2. **Chu trình 2:** Mua vật tư, hàng hóa (TK 152, 156, 1331, 331)
3. **Chu trình 3:** Bán hàng, thu tiền (TK 632, 156, 131, 511, 3331)
4. **Chu trình 4:** Chi phí hoạt động (TK 622, 641, 642, 334, 338)
5. **Chu trình 5:** Đầu tư TSCĐ (TK 211, 214, 1332, 331)
6. **Chu trình 6:** Sản xuất (TK 154, 621, 622, 627)
7. **Chu trình 7:** Vay nợ và trả nợ (TK 341, 635, 335)
8. **Chu trình 8:** Thuế GTGT (TK 3331, 133)
9. **Chu trình 9:** Kết quả kinh doanh (TK 911, 4212)

**Hiển thị:**
- Tên chu trình
- Tài khoản liên quan
- Số liệu thực tế từ sổ cái
- Tổng cộng từng chu trình

#### 8.2.3. Báo Cáo Tài Chính Khác
- **Bảng Cân đối kế toán B01-DN:** Tài sản - Nguồn vốn
- **Báo cáo KQKD B02-DN:** Biến động vốn chủ sở hữu
- **Báo cáo Lưu chuyển tiền tệ B03-DN:** Dòng tiền hoạt động, đầu tư, tài chính
- **Bản thuyết minh BCTC B09-DN:** Giải thích chi tiết số liệu

### 8.3. Tính Năng Đặc Biệt
- **Tính toán real-time:** Đọc số liệu từ sổ cái tự động
- **Hai chế độ xem:** Báo cáo KQKD và 9 chu trình
- **Thuế suất tự động:** Tính theo quy định lũy tiến
- **Định dạng TT99:** Tuân thủ Thông tư 99/2025/TT-BTC
- **Xuất Excel:** Xuất báo cáo ra file Excel

### 8.4. Phân Quyền
- **Admin, KTT, GD Kinh Doanh:** Được xem báo cáo tài chính

---

## 9. QUY TRÌNH KẾT CHUYỂN KHÓA SỔ CUỐI KỲ

### 9.1. Mô Tả Module
Module Kết chuyển khóa sổ cuối kỳ thực hiện việc tổng hợp, phân loại số liệu cuối kỳ và tự động sinh bút toán kết chuyển doanh thu, chi phí vào quỹ kết quả kinh doanh.

### 9.2. Chức Năng Chính

#### 9.2.1. Thực Hiện Khóa Sổ Tự Động
**Mục đích:** Tự động kết chuyển số dư các tài khoản doanh thu, chi phí về tài khoản 911 và chuyển kết quả vào 421.

**Quy trình:**
1. **Kiểm tra điều kiện:**
   - Xác định công ty đang làm việc
   - Xác định niên độ kế toán
   - Kiểm tra có chứng từ phát sinh không

2. **Kích hoạt engine khóa sổ:**
   - Gửi yêu cầu POST đến `/api/report/closing`
   - Backend thực hiện các bước:
     * Tính toán lãi/lỗ ròng phát sinh
     * Kết chuyển doanh thu (511, 515, 711) → 911
     * Kết chuyển chi phí (632, 635, 641, 642, 811) → 911
     * Chuyển kết quả 911 → 421 (LNST chưa phân phối)

3. **Hiển thị kết quả:**
   - Log tiến trình xử lý
   - Lãi/lỗ ròng phát sinh
   - Thông báo thành công/thất bại

**Bút toán kết chuyển mẫu:**
```
1. Kết chuyển doanh thu:
Nợ TK 511 (Doanh thu bán hàng)
Nợ TK 515 (Doanh thu tài chính)
Nợ TK 711 (Thu nhập khác)
   Có TK 911 (Xác định kết quả kinh doanh)

2. Kết chuyển chi phí:
Nợ TK 911 (Xác định kết quả kinh doanh)
   Có TK 632 (Giá vốn)
   Có TK 635 (Chi phí tài chính)
   Có TK 641 (Chi phí bán hàng)
   Có TK 642 (Chi phí QLDN)
   Có TK 811 (Chi phí khác)

3. Chuyển kết quả:
Nợ TK 911 (Xác định kết quả kinh doanh)
   Có TK 421 (LNST chưa phân phối)
```

#### 9.2.2. Xem Số Dư Tài Khoản Cuối Kỳ
**Mục đích:** Hiển thị bảng cân đối kế toán nội bộ trước và sau khi khóa sổ.

**Cấu trúc báo cáo:**

**A. TÀI SẢN**
- **I. Tài sản ngắn hạn:**
  - TK 111: Tiền mặt
  - TK 112: Tiền gửi ngân hàng
  - TK 131: Phải thu khách hàng
  - TK 138: Phải thu khác
  - TK 141: Tạm ứng
  - TK 152: Nguyên liệu, vật liệu
  - TK 153: Công cụ, dụng cụ
  - TK 156: Hàng hóa kho

- **II. Tài sản dài hạn:**
  - TK 211: TSCĐ hữu hình
  - TK 214: Hao mòn TSCĐ (ghi giảm)
  - TK 215: Tài sản sinh học
  - TK 229: Dự phòng tổn thất (ghi giảm)

**B. NGUỒN VỐN**
- **I. Nợ phải trả:**
  - TK 331: Phải trả người bán
  - TK 333: Thuế và các khoản phải nộp NSNN
  - TK 334: Phải trả người lao động
  - TK 338: Phải trả, phải nộp khác
  - TK 341: Vay và nợ thuê tài chính

- **II. Vốn chủ sở hữu:**
  - TK 411: Vốn đầu tư của chủ sở hữu
  - TK 418: Quỹ đầu tư phát triển
  - TK 421: LNST chưa phân phối

**Kiểm tra cân đối:**
- Tổng Tài sản = Tổng Nguồn vốn
- Hệ thống tự động kiểm tra và cảnh báo nếu lệch

### 9.3. Tính Năng Đặc Biệt
- **Khóa sổ tự động:** Engine backend xử lý toàn bộ quy trình
- **Log real-time:** Hiển thị tiến trình xử lý từng bước
- **Kiểm tra cân đối:** Tự động đối chiếu Tổng Tài sản = Tổng Nguồn vốn
- **Xuất Excel:** Xuất bảng cân đối ra file Excel
- **Bảo vệ sổ sách:** Không cho phép xóa/sửa sau khi khóa sổ

### 9.4. Phân Quyền
- **Admin, KTT, GD Kinh Doanh:** Được phép thực hiện khóa sổ

---

## 10. QUY TRÌNH QUẢN LÝ TÀI SẢN CỐ ĐỊNH

### 10.1. Mô Tả Module
Module Tài sản cố định & Khấu hao quản lý toàn bộ vòng đời tài sản cố định từ mua sắm, sử dụng, khấu hao đến thanh lý.

### 10.2. Chức Năng Chính

#### 10.2.1. Quản Lý TSCĐ
- Đăng ký tài sản mới (TK 211)
- Theo dõi nguyên giá, giá trị còn lại
- Quản lý thông tin: vị trí, bộ phận sử dụng, ngày mua

#### 10.2.2. Tính Khấu Hao
**Phương pháp khấu hao:**
- Khấu hao đường thẳng
- Khấu hao số dư giảm dần
- Khấu hao theo sản lượng

**Định khoản khấu hao:**
```
Nợ TK 642 (Chi phí khấu hao)
   Có TK 214 (Hao mòn TSCĐ)
```

#### 10.2.3. Thanh Lý, Nhượng Bán
- Tính lãi/lỗ thanh lý
- Định khoản:
```
Nợ TK 211 (Nguyên giá TSCĐ)
Nợ TK 214 (Hao mòn TSCĐ)
   Có TK 211 (TSCĐ thanh lý)
   Có TK 711/811 (Lãi/lỗ thanh lý)
```

### 10.3. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 11. QUY TRÌNH TẬP HỢP CHI PHÍ GIÁ THÀNH

### 11.1. Mô Tả Module
Module Tập hợp chi phí Giá thành phân bổ chi phí sản xuất, tính giá thành sản phẩm theo quy trình sản xuất.

### 11.2. Chức Năng Chính

#### 11.2.1. Tập Hợp Chi Phí Sản Xuất
**Chi phí trực tiếp:**
- Nguyên liệu trực tiếp (TK 621)
- Nhân công trực tiếp (TK 622)

**Chi phí gián tiếp:**
- Chi phí sản xuất chung (TK 627)
- Phân bổ theo cơ sở hợp lý

#### 11.2.2. Tính Giá Thành
- Tính giá thành sản phẩm hoàn thành
- Tính giá thành sản phẩm dở dang (WIP)
- Phân bổ chi phí điều hành

**Định khoản chuyển chi phí:**
```
Nợ TK 621, 622, 627 (Chi phí tập hợp)
   Có TK 152, 154, 331, 334 (Các nguồn chi phí)

Nợ TK 156 (Giá thành SP hoàn thành)
   Có TK 621, 622, 627 (Chi phí tập hợp)
```

### 11.3. Phân Quyền
- **Admin, KTT, GD Kinh Doanh:** Được phép sử dụng module

---

## 12. QUY TRÌNH QUẢN LÝ CHỨNG TỪ TỔNG HỢP

### 12.1. Mô Tả Module
Module Quản lý Chứng từ Tổng hợp cung cấp giao diện tra cứu, quản lý toàn bộ chứng từ kế toán trong hệ thống.

### 12.2. Chức Năng Chính

#### 12.2.1. Tra Cứu Chứng Từ
- Xem danh sách tất cả chứng từ
- Lọc theo loại chứng từ, ngày tháng, đối tác
- Tìm kiếm theo số chứng từ, nội dung

#### 12.2.2. Quản Lý Chứng Từ
- Xem chi tiết chứng từ
- Xem bút toán định khoản
- Xuất chứng từ ra Excel
- Theo dõi trạng thái chứng từ

#### 12.2.3. Phân Loại Chứng Từ
- **PT:** Phiếu Thu
- **PC:** Phiếu Chi
- **NK:** Phiếu Nhập Kho
- **PK:** Phiếu Xuất Kho / Phiếu Khác
- **TL:** Phiếu Tiền Lương
- **PST:** Phiếu Kết chuyển

### 12.3. Tính Năng Đặc Biệt
- **Tra cứu toàn diện:** Tất cả chứng từ trong một giao diện
- **Chi tiết đa dòng:** Xem đầy đủ các dòng bút toán
- **Xuất báo cáo:** Xuất Excel theo điều kiện lọc
- **Theo dõi real-time:** Cập nhật liên tục khi có chứng từ mới

### 12.4. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 13. QUY TRÌNH QUẢN LÝ KHO TỔNG HỢP

### 13.1. Mô Tả Module
Module Quản lý Kho Tổng hợp theo dõi nhập kho, xuất kho, tồn kho của hàng hóa, vật tư, nguyên liệu.

### 13.2. Chức Năng Chính

#### 13.2.1. Nhập Kho
- Nhập kho mua hàng (từ module Purchasing)
- Nhập kho trả lại từ khách hàng
- Nhập kho điều chuyển từ kho khác

#### 13.2.2. Xuất Kho
- Xuất kho bán hàng
- Xuất kho sử dụng nội bộ
- Xuất kho trả lại nhà cung cấp
- Xuất kho điều chuyển

#### 13.2.3. Theo Dõi Tồn Kho
- Số dư đầu kỳ
- Phát sinh nhập trong kỳ
- Phát sinh xuất trong kỳ
- Số dư cuối kỳ

**Công thức:**
```
Tồn kho cuối kỳ = Tồn kho đầu kỳ + Nhập kho - Xuất kho
```

#### 13.2.4. Báo Cáo Kho
- Bảng kê nhập/xuất tồn (BKNT)
- Số liệu tồn kho theo mặt hàng
- Đánh giá giá trị tồn kho

### 13.3. Định Khoản Kho

**Nhập kho:**
```
Nợ TK 156 (Hàng hóa kho tổng)
   Có TK 331 (Phải trả NCC) hoặc TK 111/112 (Tiền mặt/tiền gửi)
```

**Xuất kho:**
```
Nợ TK 632 (Giá vốn hàng bán) hoặc TK 621 (Nguyên liệu)
   Có TK 156 (Hàng hóa kho tổng)
```

### 13.4. Phân Quyền
- **Admin, KTT, NV:** Được phép sử dụng module

---

## 14. QUY TRÌNH DASHBOARD DÒNG TIỀN

### 14.1. Mô Tả Module
Module Dashboard dòng tiền cung cấp cái nhìn tổng quan về tình hình tài chính, dòng tiền vào/ra của doanh nghiệp.

### 14.2. Chức Năng Chính

#### 14.2.1. Theo Dõi Dòng Tiền
- **Dòng tiền hoạt động:** Thu từ bán hàng, chi cho hoạt động
- **Dòng tiền đầu tư:** Mua bán TSCĐ, đầu tư tài chính
- **Dòng tiền tài chính:** Vay nợ, trả nợ, chia cổ tức

#### 14.2.2. Chỉ Số Tài Chính
- Tỷ suất lợi nhuận gộp
- Tỷ suất lợi nhuận ròng
- Vòng quay vốn lưu động
- Tỷ lệ nợ trên vốn chủ sở hữu

#### 14.2.3. Biểu Đồ & Báo Cáo
- Biểu đồ dòng tiền theo thời gian
- Biểu đồ cơ cấu thu chi
- Báo cáo so sánh kỳ

### 14.3. Phân Quyền
- **Admin, KTT, NV:** Được phép xem dashboard

---

## 15. QUY TRÌNH LOGISTICS & GIAO HÀNG

### 15.1. Mô Tả Module
Module Logistics / Giao hàng và Màn hình Bãi xúc quản lý hoạt động vận chuyển, giao nhận hàng hóa.

### 15.2. Chức Năng Chính

#### 15.2.1. Quản Lý Vận Chuyển
- Theo dõi đơn vị vận chuyển
- Quản lý lộ trình giao hàng
- Theo dõi trạng thái đơn hàng

#### 15.2.2. Màn Hình Bãi Xúc
- Quản lý xe vào bãi
- Theo dõi trọng lượng (cân vào/cân ra)
- Tính toán khối lượng hàng hóa
- In biên bản bãi xúc

### 15.3. Phân Quyền
- **Chỉ Admin:** Được phép sử dụng module logistics

---

## 16. PHÂN QUYỀN & BẢO MẬT HỆ THỐNG

### 16.1. Các Vai Trò Người Dùng

#### 16.1.1. Admin (Quản Trị Viên)
**Quyền hạn:**
- Toàn quyền truy cập tất cả modules
- Quản lý người dùng và phân quyền
- Cấu hình hệ thống pháp nhân
- Xem nhật ký an ninh & hệ thống
- Quản lý logistics, bãi xúc
- Bán hàng tại quầy, hóa đơn Excel

**Modules đặc quyền:**
- Cấu hình pháp nhân (Company Management)
- Nhật ký an ninh (Audit Logs)
- Bán hàng tại quầy (POS)
- Hóa đơn Excel (AutoSalesExcel)
- Logistics / Giao hàng
- Màn hình Bãi xúc

#### 16.1.2. KTT (Kế Toán Trưởng)
**Quyền hạn:**
- Quản lý tài chính toàn diện
- Báo cáo tài chính, thuế
- Khóa sổ cuối kỳ
- Quản lý chứng từ, kho
- Quản lý đối tác

**Modules được phép:**
- Quỹ & Tiền gửi ngân hàng
- Mua hàng & Nhập kho
- Quản lý Đối tác
- Tài sản cố định
- Tính lương & Trích BHXH
- Tập hợp chi phí Giá thành
- Báo cáo Thuế
- Kết chuyển khóa sổ
- Báo cáo Tài chính
- Dashboard dòng tiền
- Quản lý Chứng từ
- Quản lý Kho

#### 16.1.3. NV (Nhân Viên)
**Quyền hạn:**
- Nhập liệu nghiệp vụ
- Theo dõi chứng từ
- Quản lý kho cơ bản

**Modules được phép:**
- Quỹ & Tiền gửi ngân hàng (nhập liệu)
- Mua hàng & Nhập kho
- Quản lý Đối tác
- Dashboard dòng tiền (xem)
- Quản lý Chứng từ
- Quản lý Kho

#### 16.1.4. GD Kinh Doanh (Giám Đốc Kinh Doanh)
**Quyền hạn:**
- Xem báo cáo kinh doanh
- Theo dõi chi phí giá thành
- Xem báo cáo thuế, tài chính

**Modules được phép:**
- Khai báo số dư đầu kỳ
- Quản lý Đối tác
- Tập hợp chi phí Giá thành
- Báo cáo Thuế
- Kết chuyển khóa sổ
- Báo cáo Tài chính

### 16.2. Bảo Mật Hệ Thống

#### 16.2.1. Xác Thực Người Dùng
- Đăng nhập bằng tài khoản cá nhân
- Mật khẩu được mã hóa
- Quản lý phiên làm việc (session)

#### 16.2.2. Phân Vùng Công Ty (Multi-Tenant)
- Mỗi công ty có không gian dữ liệu riêng
- Người dùng chỉ thấy dữ liệu công ty mình
- Cấu hình pháp nhân độc lập

#### 16.2.3. Nhật Ký An Ninh (Audit Logs)
- Ghi lại mọi thao tác của người dùng
- Theo dõi thời gian, IP, hành động
- Lưu trữ để truy xuất khi cần

**Thông tin ghi nhận:**
- Người dùng thực hiện
- Thời gian thực hiện
- Hành động (tạo, sửa, xóa, xem)
- Đối tượng tác động (chứng từ, tài khoản...)
- IP address

#### 16.2.4. Bảo Vệ Chứng Từ
- Không cho phép xóa chứng từ đã khóa sổ
- Chỉ Admin mới có quyền xóa chứng từ chưa khóa sổ
- Ghi log mọi thay đổi

### 16.3. Cấu Hình Hệ Thống

#### 16.3.1. Quản Lý Công Ty (Company Management)
- Đăng ký thông tin pháp nhân
- Cấu hình thông tin kế toán:
  * Tên công ty
  * Mã số thuế
  * Địa chỉ
  * Niên độ kế toán
  * Nguyên tệ (loại tiền tệ cơ sở)

#### 16.3.2. Khai Báo Số Dư Đầu Kỳ
- Nhập số dư các tài khoản đầu kỳ
- Đảm bảo cân đối Nợ = Có
- Kiểm tra trước khi bắt đầu sử dụng hệ thống

---

## TỔNG KẾT QUY TRÌNH NGHIỆP VỤ

### Luồng Nghiệp Vụ Chuẩn

```
1. KHỞI TẠO
   └── Cấu hình pháp nhân
   └── Khai báo số dư đầu kỳ

2. NGHIỆP VỤ THƯỜNG XUYÊN
   ├── Quản lý Đối tác (KH/NCC)
   ├── Mua hàng → Nhập kho
   ├── Bán hàng → Xuất kho
   ├── Quản lý Quỹ (Thu/Chi)
   └── Tính lương & Trích BHXH

3. NGHIỆP VỤ KẾ TOÁN
   ├── Ghi sổ chứng từ
   ├── Theo dõi công nợ
   └── Đối chiếu tài khoản

4. BÁO CÁO THUẾ
   ├── Báo cáo Thuế GTGT
   ├── Báo cáo Thuế TNDN
   └── Báo cáo Thuế TNCN

5. BÁO CÁO TÀI CHÍNH
   ├── Báo cáo KQKD
   ├── Bảng Cân đối kế toán
   └── Báo cáo Lưu chuyển tiền tệ

6. KẾT THÚC KỲ
   ├── Kiểm tra sổ sách
   ├── Kết chuyển khóa sổ
   └── Xuất báo cáo tài chính
```

### Nguyên Tắc Kế Toán Áp Dụng

1. **Kế toán kép:** Mỗi nghiệp vụ đều có bút toán Nợ = Có
2. **Thông tư 99/2025/TT-BTC:** Tuân thủ chuẩn mực kế toán Việt Nam
3. **Định khoản tự động:** Hệ thống tự sinh bút toán chuẩn
4. **Kiểm soát cân đối:** Không cho phép ghi sổ nếu lệch số
5. **Đa tiền tệ:** Hỗ trợ quy đổi tự động
6. **Lưu trữ đầy đủ:** Theo dõi chi tiết từng nghiệp vụ

### Lợi Ích Hệ Thống

✓ **Tự động hóa:** Giảm thiểu thao tác thủ công, giảm sai sót
✓ **Tính toán chính xác:** Tự động tính thuế, khấu hao, lương
✓ **Báo cáo real-time:** Số liệu luôn cập nhật
✓ **Tuân thủ pháp luật:** Định dạng theo Thông tư 99
✓ **Đa người dùng:** Phân quyền linh hoạt, bảo mật cao
✓ **Multi-company:** Quản lý nhiều công ty trên cùng hệ thống
✓ **Xuất báo cáo:** Hỗ trợ Excel, PDF cho mọi báo cáo

---

**Tài liệu được tạo bởi:** Hệ thống ERP Kế Toán  
**Phiên bản:** 1.0  
**Cập nhật:** 2026  
**Căn cứ pháp lý:** Thông tư 99/2025/TT-BTC