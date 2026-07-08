# QUY TRÌNH THANH TOÁN (PAYMENT PROCEDURES)

**Phiên bản:** 2.0  
**Ngày có hiệu lực:** [NGÀY_HIỆU_LỰC]  
**Đơn vị cung cấp:** [TÊN DOANH NGHIỆP]  
**Mã số thuế:** [MÃ SỐ THUẾ]  
**Website:** [WEBSITE]  
**Hotline hỗ trợ:** [HOTLINE]  
**Email hỗ trợ:** [EMAIL_HOTRO]

---

## 1. CĂN CỨ PHÁP LÝ

Quy trình thanh toán này được xây dựng và thực thi tuân thủ nghiêm ngặt các văn bản pháp luật sau:

1.1. **Nghị định số 248/2026/NĐ-CP** (ngày 30/06/2026, hiệu lực từ 01/07/2026)  
- Văn bản mới nhất hướng dẫn Luật Thương mại điện tử 2025, **thay thế Nghị định 52/2013/NĐ-CP**.
- **Điều 14**: Quy định chi tiết về thanh toán trong thương mại điện tử:
  - Phải công khai rõ ràng từng phương thức thanh toán (cổng thanh toán, chuyển khoản, ví điện tử) kèm giải thích để khách hàng lựa chọn.
  - Phải hiển thị đầy đủ thông tin: tên phương thức, phí (nếu có), thời gian xử lý, hạn mức giao dịch.
  - Nếu có cơ chế tích điểm, hoàn điểm hoặc coupon ưu đãi đổi gói, phải công khai cách thức hình thành, tỷ lệ quy đổi và cam kết không được quy đổi điểm này thành tiền mặt.
- **Điều 15**: Yêu cầu công khai luồng xử lý giao dịch, cơ chế bảo mật cổng thanh toán.

1.2. **Nghị định số 254/2026/NĐ-CP** (ngày 30/06/2026, hiệu lực từ 01/07/2026)  
- Văn bản mới nhất hướng dẫn Luật Quản lý thuế về hóa đơn điện tử, **thay thế Nghị định 123/2020/NĐ-CP**.
- **Điều 20-25**: Quy định về xuất hóa đơn điện tử ngay khi giao dịch thành công, đúng định dạng chuẩn dữ liệu.
- Yêu cầu thông tin hóa đơn: Mẫu số, ký hiệu, số hóa đơn, MST người bán, thông tin người mua, danh mục hàng hóa, thuế suất, thuế GTGT, tổng tiền.
- Hóa đơn điện tử phải được lưu trữ theo thời hạn pháp luật (tối thiểu 10 năm).

1.3. **Luật các tổ chức tín dụng số 47/2010/QH12** và các văn bản của **Ngân hàng Nhà nước (NHNN)**  
- Quy định về thanh toán không dùng tiền mặt, đảm bảo cổng thanh toán tích hợp đã được cấp phép hoặc sử dụng đối tác Open Banking được NHNN cấp phép.

1.4. **Luật Thương mại điện tử 2025** (Luật số 122/2025/QH15) và **Nghị định 248/2026/NĐ-CP**  
- Quy định về công khai minh bạch thông tin thanh toán, bảo mật giao dịch, quyền và nghĩa vụ của các bên.

1.5. **Luật Bảo vệ quyền lợi người tiêu dùng số 35/2023/QH15**  
- Quy định về quyền khiếu nại, hoàn tiền của người tiêu dùng trong giao dịch thương mại điện tử.

---

## 2. CÁC PHƯƠNG THỨC THANH TOÁN ĐƯỢC HỖ TRỢ

Nền tảng công khai minh bạch các phương thức sau (Nghị định 248/2026 - Điều 14):

### 2.1. Chuyển khoản ngân hàng qua Open Banking (Casso)
- **Đối tác:** Casso — đối tác Open Banking được Ngân hàng Nhà nước cấp phép, kết nối trực tiếp với tài khoản ngân hàng của doanh nghiệp.
- **Cách thức:** Khách hàng chuyển khoản đúng số tiền và nội dung (mã đơn hàng `WEB...` / `ORD...`) → hệ thống tự động đối soát (reconcile) qua webhook và ghi nhận phiếu thu (PT).
- **Thời gian xử lý:** Tự động trong vòng **5-15 phút** sau khi khách hàng chuyển khoản thành công.
- **Phí giao dịch:** Miễn phí (không thu thêm phí từ khách hàng).
- **Thông tin tài khoản:** Hiển thị công khai cho từng doanh nghiệp tại `GET /api/casso/company-accounts/public?company_id=`.
- **Bảo mật:** Webhook xác thực bằng `secure_token` ngẫu nhiên (AES-256-GCM lưu trữ); thông tin tài khoản ngân hàng được mã hóa khi lưu trữ.

### 2.2. Cổng thanh toán / Ví điện tử (dự phòng)
- **[TÊN DOANH NGHIỆP]** có thể tích hợp thêm cổng thanh toán/Ví điện tử được NHNN cấp phép (ví dụ: MoMo, ZaloPay, VNPay).
- Thông tin cụ thể sẽ được công bố tại [WEBSITE]/legal/payment khi triển khai.
- **Yêu cầu bắt buộc:** Cổng thanh toán phải được NHNN cấp phép, có chứng chỉ bảo mật PCI DSS (nếu áp dụng).

### 2.3. Thanh toán tại quầy / chuyển khoản thủ công
- Áp dụng cho khách hàng doanh nghiệp có hợp đồng riêng.
- Nhân viên kế toán xác nhận thủ công trên hệ thống sau khi nhận được chuyển khoản/tiền mặt.
- Thời gian xử lý: **1-2 ngày làm việc**.

---

## 3. QUY TRÌNH ĐỐI SOÁT VÀ XUẤT CHỨNG TỪ

### 3.1. Quy trình tự động (Casso - Open Banking)
1. **Khách hàng đặt hàng** trên cửa hàng trực tuyến (storefront) → hệ thống tạo chứng từ bán hàng (XK) kèm mã đơn hàng.
2. **Khách hàng chuyển khoản** → Casso gửi webhook → hệ thống xác thực `secure_token`, đối soát với mã đơn hàng.
3. **Khi đối soát thành công:** Hệ thống tự động tạo **phiếu thu (PT)** và cập nhật trạng thái đã posted.
4. **Xuất hóa đơn điện tử ngay lập tức** (Nghị định 254/2026): Hệ thống sinh hóa đơn điện tử đúng chuẩn dữ liệu (Mẫu số, ký hiệu, số hóa đơn, MST bán, thông tin khách, thuế, tổng tiền) và lưu vào bảng `e_invoices`. Khách hàng tra cứu tại `GET /api/e-invoices/:id`.

### 3.2. Quy trình thủ công (chuyển khoản thủ công / tiền mặt)
1. Nhân viên kế toán nhận thông báo chuyển khoản/tiền mặt.
2. Kiểm tra đối soát với đơn hàng trên hệ thống.
3. Xác nhận thanh toán thủ công → tạo phiếu thu (PT).
4. Xuất hóa đơn điện tử (nếu khách hàng yêu cầu).

### 3.3. Xử lý lỗi đối soát
- Nếu webhook lỗi, hệ thống trả mã lỗi để Casso thực hiện gửi lại (retry) — đảm bảo không mất giao dịch.
- Giao dịch chưa đối soát được đánh dấu `pending` và được nhân viên xử lý thủ công trong vòng **24 giờ**.
- Khách hàng có thể yêu cầu hoàn tiền theo **Chính sách hoàn tiền & hủy gói** nếu giao dịch bị lỗi kéo dài.

---

## 4. CƠ CHẾ TÍCH ĐIỂM, HOÀN ĐIỂM VÀ COUPON (Nghị định 248/2026 - Điều 14)

> Hiện tại nền tảng chưa triển khai tích điểm / coupon. Khi triển khai, **[TÊN DOANH NGHIỆP]** cam kết tuân thủ:

### 4.1. Công khai minh bạch
- Cách thức hình thành điểm, tỷ lệ quy đổi điểm sang giá trị đơn hàng được công bố rõ ràng **trước khi áp dụng**.
- Điều kiện sử dụng, thời hạn, phạm vi áp dụng được hiển thị đầy đủ khi khách hàng chọn đổi.

### 4.2. Cấm quy đổi thành tiền mặt
- Điểm thưởng, hoàn điểm chỉ được dùng để giảm giá trị đơn hàng / nâng cấp gói dịch vụ.
- **Tuyệt đối không được quy đổi thành tiền mặt** dưới mọi hình thức (Nghị định 248/2026 - Điều 14).

### 4.3. Coupon ưu đãi đổi gói
- Điều kiện sử dụng, thời hạn, phạm vi áp dụng được hiển thị đầy đủ khi khách hàng chọn đổi.
- Không áp dụng cho các gói dịch vụ đã thanh toán trước khi áp dụng coupon.

---

## 5. BẢO MẬT CỔNG THANH TOÁN

### 5.1. Bảo mật kỹ thuật
- Cổng thanh toán (Casso) được NHNN cấp phép; giao tiếp qua API bảo mật HTTPS/TLS 1.3.
- Webhook xác thực bằng `secure_token` ngẫu nhiên (AES-256-GCM lưu trữ).
- Thông tin tài khoản ngân hàng của doanh nghiệp được mã hóa AES-256-GCM khi lưu trữ; chỉ hiển thị 4 số cuối khi công khai.
- Mọi giao dịch được ghi nhật ký kiểm toán (audit log) kèm IP và thời gian.

### 5.2. Quản lý rủi ro
- Giới hạn giao dịch: tối đa **[GIOI_HAN_GIAO_DICH]** VNĐ/ngày cho tài khoản cá nhân, **[GIOI_HAN_GIAO_DICH_DOANH_NGHIEP]** VNĐ/ngày cho tài khoản doanh nghiệp.
- Phát hiện gian lận: hệ thống tự động đánh dấu giao dịch đáng ngờ (số tiền bất thường, IP lạ, nhiều lần thử) để nhân viên xử lý thủ công.
- Chống lặp giao dịch (replay attack): mỗi giao dịch có `transaction_id` duy nhất, không cho phép trùng lặp.

### 5.3. Tuân thủ pháp lý
- Đối tác thanh toán phải có giấy phép hoạt động hợp pháp tại Việt Nam.
- Hợp đồng với đối tác thanh toán bao gồm điều khoản bảo mật dữ liệu, bồi thường thiệt hại nếu xảy ra vi phạm.
- Tuân thủ quy định của NHNN về chống rửa tiền (AML) và nhận biết khách hàng (KYC) nếu áp dụng.

---

## 6. XỬ LÝ LỖI GIAO DỊCH

### 6.1. Lỗi hệ thống
- Nếu webhook lỗi, hệ thống trả mã lỗi để Casso thực hiện gửi lại (retry) — đảm bảo không mất giao dịch.
- Giao dịch chưa đối soát được đánh dấu `pending` và được nhân viên xử lý thủ công trong vòng **24 giờ**.
- Nếu lỗi kéo dài quá **48 giờ**, hệ thống tự động gửi thông báo cho khách hàng và nhân viên kế toán.

### 6.2. Lỗi từ phía khách hàng
- Chuyển khoản sai nội dung/số tiền: khách hàng liên hệ [EMAIL_HOTRO] để được hỗ trợ đối soát thủ công.
- Chuyển khoản trùng lặp: hệ thống tự động phát hiện và hoàn tiền thừa trong vòng **3-5 ngày làm việc**.

### 6.3. Tranh chấp giao dịch
- Khách hàng có quyền yêu cầu hoàn tiền theo **Chính sách hoàn tiền & hủy gói**.
- Yêu cầu hoàn tiền phải được gửi qua `POST /api/refunds` kèm bằng chứng giao dịch (screenshot chuyển khoản, mã giao dịch).
- Thời gian xử lý: tối đa **[THOI_HAN_XU_LY_HOAN_TIEN]** ngày làm việc.

---

## 7. HÓA ĐƠN ĐIỆN TỬ (Nghị định 254/2026)

### 7.1. Xuất hóa đơn tự động
- Hóa đơn điện tử được xuất **ngay khi giao dịch thành công**, đúng định dạng chuẩn dữ liệu theo quy định của cơ quan thuế.
- Thông tin trên hóa đơn:
  - Tên, MST người bán: **[MÃ SỐ THUẾ]**.
  - Tên, MST (nếu có), địa chỉ người mua.
  - Danh mục hàng hóa/dịch vụ, số lượng, đơn giá, thuế suất, thuế GTGT, tổng tiền.
  - Mẫu số, ký hiệu, số hóa đơn theo quy định của cơ quan thuế.
- Hóa đơn được lưu trữ theo thời hạn pháp luật (tối thiểu 10 năm) và có thể tra cứu/bàn giao theo yêu cầu cơ quan thuế.

### 7.2. Tra cứu và tải hóa đơn
- Khách hàng tra cứu hóa đơn tại: `GET /api/e-invoices/:id` (cần đăng nhập).
- Tải hóa đơn dạng PDF/XML theo định dạng chuẩn của cơ quan thuế.
- Lịch sử hóa đơn được lưu trữ vĩnh viễn theo quy định thuế.

### 7.3. Điều chỉnh/hủy hóa đơn
- Hóa đơn đã xuất không thể xóa, chỉ có thể điều chỉnh/hủy theo quy định của cơ quan thuế.
- Điều chỉnh/hủy hóa đơn phải có lý do chính đáng (lỗi hệ thống, khách hàng yêu cầu) và được ghi nhận trong audit log.

---

## 8. PHƯƠNG THỨC HOÀN TRẢ DÒNG TIỀN (Khi được phê duyệt hoàn tiền)

### 8.1. Hoàn tiền về tài khoản ngân hàng
- Hoàn về đúng tài khoản chuyển khoản gốc (qua Casso/Open Banking hoặc chuyển khoản thủ công).
- Thời gian hoàn tiền: **3-5 ngày làm việc** kể từ khi phê duyệt (tùy thuộc ngân hàng).
- Phí ngân hàng (nếu có): do **[TÊN DOANH NGHIỆP]** chịu khi lỗi từ hệ thống; khách hàng chịu khi hủy chủ quan.

### 8.2. Hoàn tiền về ví điện tử / thẻ
- Nếu khách hàng thanh toán qua ví/thẻ, hoàn về chính phương thức đó.
- Thời gian hoàn tiền: **5-7 ngày làm việc** kể từ khi phê duyệt (tùy thuộc nhà cung cấp ví/thẻ).

### 8.3. Xác nhận hoàn tiền
- Khách hàng nhận xác nhận hoàn tiền qua email/thông báo đẩy.
- Trạng thái hoàn tiền được cập nhật trong hệ thống: `completed` (hoàn thành) hoặc `failed` (thất bại, có lý do).

---

## 9. BẢO MẬT VÀ QUẢN LÝ RỦI RO

### 9.1. Bảo mật giao dịch
- Mọi giao dịch được mã hóa end-to-end (HTTPS/TLS 1.3).
- Thông tin thẻ/tài khoản không được lưu trữ trên hệ thống (tokenization qua đối tác thanh toán).
- Kiểm tra chống gian lận: địa chỉ IP, thiết bị, hành vi giao dịch bất thường.

### 9.2. Giám sát và cảnh báo
- Hệ thống giám sát giao dịch 24/7, cảnh báo tự động khi phát hiện bất thường.
- Nhân viên kế toán được thông báo ngay qua email/SMS khi có giao dịch đáng ngờ.
- Báo cáo giao dịch hàng ngày/tuần/tháng cho quản trị viên.

### 9.3. Tuân thủ pháp lý
- Tuân thủ quy định của NHNN về chống rửa tiền (AML).
- Báo cáo giao dịch đáng ngờ cho cơ quan có thẩm quyền theo quy định pháp luật.
- Lưu trữ hồ sơ giao dịch theo thời hạn pháp luật (tối thiểu 10 năm).

---

## 10. QUYỀN VÀ TRÁCH NHIỆM CỦA CÁC BÊN

### 10.1. Quyền của khách hàng
- Được công khai minh bạch thông tin về phương thức thanh toán, phí giao dịch, thời gian xử lý.
- Được thông báo ngay khi giao dịch thành công/thất bại.
- Được yêu cầu xuất hóa đơn điện tử đúng định dạng pháp lý.
- Được khiếu nại, yêu cầu hoàn tiền theo quy định pháp luật và Chính sách hoàn tiền.

### 10.2. Trách nhiệm của [TÊN DOANH NGHIỆP]
- Đảm bảo hệ thống thanh toán hoạt động ổn định, bảo mật.
- Đối soát giao dịch chính xác, kịp thời.
- Xuất hóa đơn điện tử đúng quy định pháp luật.
- Xử lý khiếu nại, yêu cầu hoàn tiền theo đúng quy trình và thời hạn.
- Bảo mật thông tin thanh toán của khách hàng theo Luật BV dữ liệu cá nhân 2025.

### 10.3. Trách nhiệm của khách hàng
- Cung cấp thông tin thanh toán chính xác, đầy đủ.
- Kiểm tra kỹ thông tin trước khi xác nhận giao dịch.
- Bảo mật thông tin tài khoản ngân hàng/thẻ của mình.
- Thông báo ngay cho [TÊN DOANH NGHIỆP] nếu phát hiện giao dịch bất thường.

---

## 11. LIÊN HỆ VÀ HỖ TRỢ

### 11.1. Kênh hỗ trợ thanh toán
- **Email hỗ trợ:** [EMAIL_HOTRO]
- **Hotline:** [HOTLINE]
- **Thời gian hỗ trợ:** [THỜI_GIAN_HỖ_TRỢ]
- **Khiếu nại công khai:** `POST /api/public/complaints` (không cần đăng nhập)

### 11.2. Thông tin doanh nghiệp
- **Tên:** [TÊN DOANH NGHIỆP]
- **Mã số thuế:** [MÃ SỐ THUẾ]
- **Địa chỉ:** [ĐỊA CHỈ]
- **Website:** [WEBSITE]
- **API thông tin công khai:** `GET /api/public/legal/business-info`

### 11.3. Thời gian xử lý
- **Đối soát giao dịch tự động:** 5-15 phút.
- **Xử lý thủ công:** 1-2 ngày làm việc.
- **Khiếu nại:** tối đa **[THOI_HAN_XU_LY_KHIEU_NAI]** ngày làm việc.
- **Hoàn tiền:** tối đa **[THOI_GIAN_HOAN_TIEN]** ngày làm việc kể từ khi phê duyệt.

---

*Quy trình này có hiệu lực từ [NGÀY_HIỆU_LỰC]. Mọi cập nhật được công bố tại [WEBSITE]/legal/payment.*

**Tài liệu đính kèm:**
- Chính sách bảo mật thông tin: [WEBSITE]/legal/privacy
- Chính sách hoàn tiền & hủy gói: [WEBSITE]/legal/refund
- Điều khoản sử dụng: [WEBSITE]/legal/terms
- API documentation: [WEBSITE]/api/docs