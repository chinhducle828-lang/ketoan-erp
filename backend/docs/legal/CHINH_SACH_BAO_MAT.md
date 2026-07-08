# CHÍNH SÁCH BẢO MẬT THÔNG TIN KHÁCH HÀNG

**Phiên bản:** 2.0  
**Ngày có hiệu lực:** [NGÀY_HIỆU_LỰC]  
**Đơn vị vận hành:** [TÊN DOANH NGHIỆP]  
**Mã số thuế:** [MÃ SỐ THUẾ]  
**Người phụ trách bảo vệ dữ liệu (DPO):** [TÊN DPO] — [EMAIL DPO]  
**Số điện thoại DPO:** [SỐ ĐIỆN THOẠI DPO]

---

## 1. CĂN CỨ PHÁP LÝ

Chính sách này được xây dựng và thực thi tuân thủ nghiêm ngặt các văn bản pháp luật sau:

1.1. **Luật Bảo vệ dữ liệu cá nhân 2025** (Luật số 91/2025/QH15, ngày 28/11/2025)  
- Luật chuyên biệt đầu tiên của Việt Nam điều chỉnh toàn bộ hành vi xử lý dữ liệu số.  
- Quy định 7 quyền cơ bản của chủ thể dữ liệu (Điều 25): quyền được biết, đồng ý, truy cập, chỉnh sửa, xóa, hạn chế xử lý, phản đối, khiếu nại.  
- Yêu cầu chỉ định nhân sự bảo vệ dữ liệu (DPO) đối với doanh nghiệp xử lý dữ liệu quy mô lớn (Điều 33).

1.2. **Nghị định số 356/2025/NĐ-CP** (ngày 31/12/2025, hiệu lực từ 01/01/2026)  
- Văn bản hướng dẫn thi hành Luật BV dữ liệu cá nhân, **thay thế hoàn toàn Nghị định 13/2023/NĐ-CP**.  
- Quy định chi tiết biểu mẫu báo cáo, vai trò DPO (Điều 12), quy trình Đánh giá tác động xử lý dữ liệu (DPIA) (Điều 15).  
- Quy định thời hạn lưu trữ dữ liệu và thủ tục xóa dữ liệu theo yêu cầu (Điều 20).  
- Quy định biện pháp bảo mật kỹ thuật bắt buộc: mã hóa AES-256, băm mật khẩu bcrypt, quản lý phiên JWT (Điều 18).

1.3. **Luật An toàn thông tin mạng số 86/2015/QH13** và **Luật An ninh mạng số 24/2018/QH14**  
- Đảm bảo hạ tầng lưu trữ và các biện pháp kỹ thuật chống mã độc, rò rỉ thông tin cá nhân.

1.4. **Luật Thương mại điện tử 2025** (Luật số 122/2025/QH15) và **Nghị định 248/2026/NĐ-CP**  
- Quy định về công khai minh bạch chính sách bảo mật trên website/ứng dụng thương mại điện tử.

---

## 2. PHẠM VI ÁP DỤNG

Chính sách này áp dụng cho toàn bộ người dùng của nền tảng phần mềm kế toán dưới dạng dịch vụ (SaaS ERP Kế toán) do **[TÊN DOANH NGHIỆP]** vận hành, bao gồm:

- Người quản trị hệ thống (admin, root admin);
- Kế toán trưởng, nhân viên kế toán, nhân viên bán hàng, nhân viên kho;
- Khách hàng của doanh nghiệp sử dụng nền tảng (người mua hàng trên cửa hàng trực tuyến / storefront);
- Đối tác (khách hàng, nhà cung cấp) được lưu trữ trong hệ thống.

**Không áp dụng** cho dữ liệu đã được ẩn danh hóa (anonymized) không thể xác định danh tính chủ thể.

---

## 3. CÁC LOẠI DỮ LIỆU CÁ NHÂN ĐƯỢC XỬ LÝ

### 3.1. Dữ liệu do người dùng cung cấp
- Họ tên đăng nhập, mật khẩu (được băm bằng bcrypt, không lưu plaintext);
- Họ tên, số điện thoại, địa chỉ email, địa chỉ liên hệ;
- Thông tin doanh nghiệp: tên, mã số thuế, địa chỉ, giấy phép kinh doanh.

### 3.2. Dữ liệu thu thập tự động
- Địa chỉ IP (hỗ trợ IPv4 và IPv6), thông tin thiết bị (User-Agent);
- Nhật ký truy cập, lịch sử đăng nhập, lịch sử thao tác (audit log);
- Thông tin phiên làm việc (session), token xác thực (JWT);
- Dữ liệu đăng ký nhận thông báo đẩy (push subscription).

### 3.3. Dữ liệu từ bên thứ ba
- Thông tin giao dịch ngân hàng qua đối tác Open Banking (Casso) phục vụ đối soát thanh toán.

---

## 4. MỤC ĐÍCH VÀ CƠ SỞ XỬ LÝ (Điều 17, Luật BV dữ liệu cá nhân 2025)

| Mục đích | Cơ sở xử lý | Thời hạn lưu trữ |
|----------|-------------|------------------|
| Cung cấp dịch vụ kế toán, xuất chứng từ, hóa đơn điện tử | Thực hiện hợp đồng | Tối thiểu 10 năm theo quy định thuế |
| Đối soát thanh toán, quản lý công nợ | Thực hiện hợp đồng | Tối thiểu 10 năm theo quy định thuế |
| Bảo mật hệ thống, phát hiện gian lận | Lợi ích chính đáng | 90 ngày (audit log) |
| Cải thiện dịch vụ, phân tích hành vi | Sự đồng ý của chủ thể | Có thể rút lại bất cứ lúc nào |
| Gửi thông báo đẩy (push notification) | Sự đồng ý của chủ thể | 90 ngày không hoạt động sẽ xóa |

**Lưu ý:** Đối với dữ liệu không phục vụ trực tiếp hợp đồng, chúng tôi chỉ xử lý sau khi có sự đồng ý của bạn (click-wrap agreement khi đăng ký/truy cập).

---

## 5. BIỆN PHÁP BẢO VỆ DỮ LIỆU (KỸ THUẬT) - Điều 18, NĐ 356/2025/NĐ-CP

Nền tảng áp dụng các biện pháp sau để bảo vệ dữ liệu cá nhân:

### 5.1. Mã hóa dữ liệu nhạy cảm
- **AES-256-GCM**: mã hóa dữ liệu nhạy cảm (số tài khoản ngân hàng, tên chủ tài khoản) với khóa 256-bit, xác thực toàn vẹn bằng auth tag.
- Khóa mã hóa được quản lý qua biến môi trường `ENCRYPTION_KEY` (64 ký tự hex), không hardcode trong mã nguồn.

### 5.2. Băm mật khẩu
- Sử dụng **bcrypt** với salt rounds = 10 — không lưu mật khẩu dạng plaintext.

### 5.3. Quản lý phiên đăng nhập
- Access token (JWT) ngắn hạn: **15 phút**.
- Refresh token lưu dưới cookie **HttpOnly**, **Secure** (production), **SameSite=None**.
- Refresh token được băm (SHA-256) trước khi lưu vào database.

### 5.4. Cách ly dữ liệu (Multi-tenant)
- Mỗi doanh nghiệp chỉ truy cập dữ liệu của chính mình thông qua kiểm soát quyền ở mức công ty (`canAccessCompany`, `checkCompanyAccess`) và phân quyền theo vai trò (RBAC).

### 5.5. Nhật ký kiểm toán (Audit log)
- Ghi nhận đầy đủ hành vi truy cập, thay đổi dữ liệu kèm địa chỉ IP và thời gian.
- Lưu trữ tối thiểu 90 ngày, có thể kéo dài theo quy định thuế.

### 5.6. Bảo vệ mạng (WAF)
- Web Application Firewall: giới hạn tốc độ truy cập (rate limiting), chống SQL injection, chống XSS.
- Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options.

### 5.7. Kiểm soát truy cập
- Xác thực đa lớp, phân quyền chức năng theo vai trò.
- Giới hạn đăng nhập sai (brute-force protection): tối đa 5 lần thất bại trong 15 phút.

---

## 6. QUYỀN CỦA CHỦ THỂ DỮ LIỆU (Điều 25, Luật BV dữ liệu cá nhân 2025)

Theo Luật Bảo vệ dữ liệu cá nhân 2025, bạn có các quyền sau:

1. **Quyền được biết** — được thông báo về việc xử lý dữ liệu cá nhân (chính sách này).
2. **Quyền đồng ý / rút lại đồng ý** — bạn có thể rút lại sự đồng ý bất cứ lúc nào (liên hệ DPO).
3. **Quyền truy cập** — xem, xuất dữ liệu cá nhân của mình (`GET /api/users/me/export-data`).
4. **Quyền chỉnh sửa** — cập nhật thông tin cá nhân.
5. **Quyền xóa / quyền bị lãng quên** — yêu cầu xóa tài khoản và ẩn danh hóa dữ liệu cá nhân (`DELETE /api/users/me`).
6. **Quyền hạn chế xử lý, quyền phản đối, quyền khiếu nại** — gửi đến DPO hoặc cơ quan có thẩm quyền.

**Cách thực hiện quyền:**
- API: `GET /api/users/me/export-data` (xuất dữ liệu), `DELETE /api/users/me` (xóa tài khoản).
- Email: [EMAIL DPO]
- Khiếu nại công khai: `POST /api/public/complaints` (không cần đăng nhập).
- Thời gian xử lý: tối đa **15 ngày làm việc** kể từ khi nhận yêu cầu hợp lệ.

---

## 7. NHÂN SỰ BẢO VỆ DỮ LIỆU (DPO) VÀ ĐÁNH GIÁ TÁC ĐỘNG (DPIA)

### 7.1. DPO (Điều 33, Luật BV dữ liệu cá nhân 2025)
- **Tên DPO:** [TÊN DPO]
- **Email:** [EMAIL DPO]
- **Số điện thoại:** [SỐ ĐIỆN THOẠI DPO]
- **Nhiệm vụ:** giám sát việc tuân thủ chính sách, làm đầu mối liên lạc với chủ thể dữ liệu và cơ quan quản lý, tư vấn về DPIA.

### 7.2. Đánh giá tác động xử lý dữ liệu (DPIA) - Điều 15, NĐ 356/2025/NĐ-CP
- Được thực hiện **trước khi triển khai** các tính năng xử lý dữ liệu cá nhân quy mô lớn hoặc rủi ro cao (ví dụ: tích hợp thanh toán, phân tích hành vi, nhận dạng sinh trắc học).
- Hồ sơ DPIA được lưu trữ và sẵn sàng báo cáo theo biểu mẫu của Nghị định 356/2025/NĐ-CP.
- DPIA được rà soát lại ít nhất mỗi năm hoặc khi có thay đổi lớn về công nghệ/xử lý dữ liệu.

### 7.3. Báo cáo vi phạm dữ liệu cá nhân
- Khi phát hiện sự cố rò rỉ dữ liệu, **[TÊN DOANH NGHIỆP]** thực hiện:
  1. Ngăn chặn và khắc phục sự cố trong vòng **24 giờ**.
  2. Thông báo cho chủ thể dữ liệu bị ảnh hưởng trong vòng **72 giờ**.
  3. Báo cáo cho Bộ Công an và cơ quan có thẩm quyền theo thời hạn pháp luật (tối đa 7 ngày làm việc).

---

## 8. THỜI HẠN LƯU GIỮ VÀ XÓA DỮ LIỆU (Điều 20, NĐ 356/2025/NĐ-CP)

| Loại dữ liệu | Thời hạn lưu trữ | Cơ sở pháp lý |
|--------------|------------------|---------------|
| Dữ liệu kế toán, hóa đơn điện tử | Tối thiểu 10 năm | Luật Quản lý thuế, NĐ 254/2026/NĐ-CP |
| Dữ liệu phiên làm việc (session) | [REFRESH_TOKEN_EXPIRE_DAYS] ngày | Nghị định 356/2025/NĐ-CP |
| Đăng ký thông báo đẩy (push) | 90 ngày không hoạt động | Lợi ích chính đáng |
| Audit log | Tối thiểu 90 ngày | Nghị định 356/2025/NĐ-CP |
| Dữ liệu khách hàng sau chấm dứt hợp đồng | Xóa/ẩn danh hóa sau 30 ngày | Luật BV dữ liệu cá nhân 2025 |

**Xóa dữ liệu theo yêu cầu:**
- Khi chủ thể dữ liệu yêu cầu xóa tài khoản (`DELETE /api/users/me`), dữ liệu cá nhân sẽ bị xóa hoặc ẩn danh hóa trong vòng **15 ngày làm việc**.
- Trường hợp pháp luật buộc phải lưu trữ (dữ liệu kế toán, hóa đơn), dữ liệu sẽ được giữ lại nhưng không sử dụng cho mục đích khác.

---

## 9. CHIA SẺ VÀ CHUYỂN GIAO DỮ LIỆU (Điều 21, Luật BV dữ liệu cá nhân 2025)

### 9.1. Chia sẻ với bên thứ ba
- Dữ liệu chỉ được chia sẻ với bên thứ ba phục vụ cung cấp dịch vụ (ví dụ: Casso – đối tác Open Banking được Ngân hàng Nhà nước cấp phép).
- Yêu cầu bắt buộc: **Hợp đồng bảo mật dữ liệu (DPA)** với các điều khoản ràng buộc về bảo vệ dữ liệu.
- Danh sách đối tác xử lý dữ liệu được công khai tại đây: [WEBSITE]/legal/privacy#partners.

### 9.2. Chuyển giao dữ liệu ra nước ngoài
- **Không chuyển giao dữ liệu cá nhân ra khỏi lãnh thổ Việt Nam** trừ khi có sự đồng ý rõ ràng của chủ thể và tuân thủ Luật Bảo vệ dữ liệu cá nhân 2025.
- Trường hợp chuyển giao (ví dụ: sử dụng dịch vụ cloud quốc tế), doanh nghiệp phải thông báo cho cơ quan quản lý và đảm bảo cơ chế bảo vệ dữ liệu tương đương.

---

## 10. COOKIES VÀ CÔNG NGHỆ THEO DÕI

- Sử dụng cookie **HttpOnly**, **Secure**, **SameSite=None** cho refresh token.
- Không sử dụng cookie để theo dõi hành vi người dùng trên các website khác (third-party tracking).
- Người dùng có thể từ chối cookie không cần thiết thông qua cài đặt trình duyệt.

---

## 11. QUYỀN CỦA TRẺ EM VÀ DỮ LIỆU NHẠY CẢM

- Nền tảng không hướng đến người dùng dưới 18 tuổi.
- Không cố ý thu thập dữ liệu cá nhân của trẻ em mà không có sự đồng ý của phụ huynh/người giám hộ.

---

## 12. THAY ĐỔI CHÍNH SÁCH

- Mọi thay đổi chính sách sẽ được thông báo trước **ít nhất 7 ngày** qua email hoặc thông báo trên hệ thống.
- Phiên bản mới nhất luôn được công bố tại: [WEBSITE]/legal/privacy.
- Lịch sử phiên bản:
  - v1.0: [NGÀY] — Phiên bản ban đầu.
  - v2.0: [NGÀY] — Cập nhật theo NĐ 356/2025/NĐ-CP, Luật BV dữ liệu cá nhân 2025.

---

## 13. LIÊN HỆ VÀ KHIẾU NẠI

Mọi thắc mắc về bảo mật dữ liệu, vui lòng liên hệ:

- **DPO:** [TÊN DPO]  
  - Email: [EMAIL DPO]  
  - Số điện thoại: [SỐ ĐIỆN THOẠI DPO]  
- **Hotline hỗ trợ:** [HOTLINE]  
- **Địa chỉ trụ sở:** [ĐỊA CHỈ]  
- **Website:** [WEBSITE]  
- **Khiếu nại công khai:** `POST /api/public/complaints` (không cần đăng nhập)

**Thời gian xử lý khiếu nại:** tối đa **15 ngày làm việc** kể từ khi nhận yêu cầu hợp lệ.

---

*Chính sách này được cập nhật theo quy định pháp luật hiện hành. Phiên bản mới nhất luôn được công bố tại [WEBSITE]/legal/privacy.*

**Tài liệu đính kèm:**
- Biểu mẫu yêu cầu xuất dữ liệu cá nhân (theo NĐ 356/2025/NĐ-CP Phụ lục 3).
- Biểu mẫu yêu cầu xóa dữ liệu cá nhân (theo NĐ 356/2025/NĐ-CP Phụ lục 4).
- Hồ sơ Đánh giá tác impact xử lý dữ liệu (DPIA) - có sẵn upon request.