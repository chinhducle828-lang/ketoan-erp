# THỎA THUẬN BẢO MẬT THÔNG TIN (NDA)
## Mẫu thỏa thuận bảo mật cho Lập trình viên / Nhân viên kỹ thuật

**Phiên bản:** 1.0  
**Ngày hiệu lực:** [NGÀY_HIỆU_LỰC]  
**Đơn vị:** [TÊN DOANH NGHIỆP]  
**Mã số thuế:** [MÃ SỐ THUẾ]

---

## PHẦN 1: THÔNG TIN CÁC BÊN

### Bên A (Bên tiết lộ / Công ty):
- **Tên đầy đủ:** [TÊN DOANH NGHIỆP]
- **Mã số thuế:** [MÃ SỐ THUẾ]
- **Địa chỉ trụ sở:** [ĐỊA CHỈ]
- **Người đại diện pháp luật:** [NGƯỜI_DAI_DIỆN]
- **Chức vụ:** [CHỨC_VỤ]
- **Số điện thoại:** [SỐ ĐIỆN THOẠI]
- **Email:** [EMAIL]

### Bên B (Bên nhận tiết lộ / Lập trình viên):
- **Họ và tên:** [HỌ TÊN LẬP TRÌNH VIÊN]
- **Số CMND/CCCD:** [SỐ CMND/CCCD]
- **Ngày cấp:** [NGÀY CẤP]
- **Nơi cấp:** [NƠI CẤP]
- **Địa chỉ thường trú:** [ĐỊA CHỈ]
- **Số điện thoại:** [SỐ ĐIỆN THOẠI]
- **Email:** [EMAIL]
- **Vị trí công việc:** [VỊ TRÍ] (ví dụ: Lập trình viên Frontend, Backend Developer, DevOps Engineer)

---

## PHẦN 2: ĐỊNH NGHĨA THÔNG TIN MẬT

### 2.1. Thông tin mật (Confidential Information) bao gồm nhưng không giới hạn ở:

**A. Mã nguồn và tài sản trí tuệ:**
- Mã nguồn (source code) của phần mềm, ứng dụng, thư viện, framework.
- Mã máy (object code), mã bytecode, mã thực thi (executable).
- Thuật toán, logic nghiệp vụ, cấu trúc cơ sở dữ liệu, sơ đồ ERD.
- Tài liệu kỹ thuật: tài liệu thiết kế (design doc), tài liệu API, tài liệu hướng dẫn cài đặt (deployment guide).
- Giao diện người dùng (UI/UX), thiết kế đồ họa, bộ nhận diện thương hiệu (logo, màu sắc, font chữ).
- Thông tin về kiến trúc hệ thống, cấu hình server, thông tin đăng nhập (credentials).

**B. Dữ liệu kinh doanh:**
- Danh sách khách hàng, đối tác, nhà cung cấp (customer list, partner list).
- Thông tin tài chính: doanh thu, chi phí, giá cả, chính sách giá (pricing strategy).
- Kế hoạch kinh doanh, chiến lược marketing, kế hoạch sản phẩm (roadmap).
- Dữ liệu người dùng: thông tin cá nhân, lịch sử giao dịch, hành vi sử dụng (theo Luật BV dữ liệu cá nhân 2025).

**C. Thông tin kỹ thuật:**
- API keys, tokens, certificates, encryption keys, passwords.
- Thông tin bảo mật: lỗ hổng bảo mật (vulnerabilities), kế hoạch vá lỗi (patch plan).
- Công nghệ độc quyền, bí mật kinh doanh (trade secrets), know-how.
- Thông tin nhà cung cấp dịch vụ bên thứ ba (Casso, cloud provider, v.v.).

**D. Thông tin nội bộ:**
- Kế hoạch nhân sự, chính sách nội bộ, quy trình vận hành.
- Thông tin về giao dịch mua bán, sáp nhập, hợp tác (M&A).
- Báo cáo nội bộ, phân tích tài chính, dự báo doanh thu.

### 2.2. Thông tin không phải thông tin mật:
Thông tin không bị coi là thông tin mật nếu:
- Đã được công khai chính thức (public domain) trước khi tiết lộ.
- Đã được công khai sau khi tiết lộ không do lỗi của Bên B.
- Được tiết lộ từ bên thứ ba có quyền hợp pháp (không vi phạm NDA).
- Được yêu cầu tiết lộ theo pháp luật hoặc quyết định của cơ quan có thẩm quyền (tòa án, cơ quan điều tra).

---

## PHẦN 3: NGHĨA VỤ CỦA BÊN B (LẬP TRÌNH VIÊN)

### 3.1. Bảo mật thông tin
Bên B cam kết:

1. **Giữ bí mật:** Giữ bí mật tuyệt đối mọi thông tin mật của Bên A, không tiết lộ cho bên thứ ba dưới bất kỳ hình thức nào (bằng lời nói, văn bản, hình ảnh, video, sao chép, truyền tải qua mạng, v.v.).

2. **Chỉ sử dụng cho mục đích công việc:** Chỉ sử dụng thông tin mật để thực hiện công việc được giao (develop, test, deploy, maintain phần mềm), không sử dụng cho mục đích cá nhân hoặc cho bên thứ ba.

3. **Không sao chép trái phép:** Không sao chép, in ấn, lưu trữ thông tin mật vào thiết bị cá nhân (USB, laptop cá nhân, email cá nhân, cloud storage cá nhân) trừ khi có sự cho phép bằng văn bản của Bên A.

4. **Không chia sẻ quyền truy cập:** Không chia sẻ tài khoản (username/password), API keys, SSH keys, VPN credentials với người khác (kể cả đồng nghiệp) trừ khi có sự cho phép của Bên A.

5. **Bảo vệ repository:** Không push code chứa thông tin mật (API keys, passwords, database credentials) lên public repository (GitHub, GitLab public) hoặc repository cá nhân.

6. **Báo cáo sự cố:** Ngay lập tức báo cáo cho Bên A nếu phát hiện:
   - Mất mát thiết bị (laptop, điện thoại) chứa thông tin mật.
   - Tiết lộ thông tin mật cho người không có quyền (vô tình hoặc cố ý).
   - Phát hiện lỗ hổng bảo mật (vulnerability) trong hệ thống.

### 3.2. Hạn chế truy cập (Need-to-Know Principle)
- Chỉ truy cập thông tin mật trong phạm vi cần thiết để thực hiện công việc (need-to-know basis).
- Không truy cập thông tin của các phòng ban khác (ví dụ: nhân viên kế toán không truy cập source code, developer không truy cập dữ liệu tài chính nhạy cảm).
- Không truy cập dữ liệu của khách hàng khác (vi phạm cách ly multi-tenant).

### 3.3. Bảo mật thiết bị và môi trường làm việc
- Sử dụng mật khẩu mạnh (ít nhất 12 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt) cho tất cả tài khoản.
- Kích hoạt xác thực hai yếu tố (2FA/MFA) cho tất cả tài khoản quan trọng (Git, email, cloud console, database).
- Không cài đặt phần mềm độc hại (malware, virus, trojan) trên thiết bị làm việc.
- Cập nhật hệ điều hành, trình duyệt, phần mềm định kỳ để vá lỗ hổng bảo mật.
- Sử dụng VPN khi làm việc từ xa (remote work) để mã hóa kết nối mạng.

### 3.4. Làm việc từ xa (Remote Work)
- Không làm việc trên mạng Wi-Fi công cộng không bảo mật (public Wi-Fi) nếu không có VPN.
- Không để thiết bị (laptop, điện thoại) không giám sát trong nơi công cộng.
- Sử dụng màn hình khóa (lock screen) khi rời khỏi thiết bị.
- Mã hóa ổ cứng (full disk encryption) trên thiết bị làm việc.

---

## PHẦN 4: NGHĨA VỤ CỦA BÊN A (CÔNG TY)

### 4.1. Cung cấp quyền truy cập
- Cung cấp quyền truy cập cần thiết (Git repository, Jira, Slack, cloud console) để Bên B thực hiện công việc.
- Cấp quyền truy cập theo nguyên tắc "quyền tối thiểu cần thiết" (least privilege principle).
- Thu hồi quyền truy cập ngay lập tức khi hợp đồng kết thúc hoặc Bên B nghỉ việc.

### 4.2. Đào tạo và hướng dẫn
- Đào tạo về chính sách bảo mật thông tin, quy trình vận hành an toàn.
- Hướng dẫn sử dụng công cụ phát triển (Git, IDE, cloud platform) một cách an toàn.
- Cập nhật thường xuyên về các mối đe dọa bảo mật mới (phishing, ransomware, v.v.).

### 4.3. Giám sát và kiểm tra
- Giám sát hoạt động truy cập hệ thống (access log, audit log) để phát hiện hành vi bất thường.
- Kiểm tra định kỳ (quarterly/annual) việc tuân thủ NDA của nhân viên.
- Thực hi penetration test, security audit định kỳ để phát hiện lỗ hổng.

### 4.4. Hỗ trợ pháp lý
- Hỗ trợ Bên B nếu Bên B bị kiện/tố cáo do thực hiện công việc theo chỉ đạo của Bên A (trong phạm vi hợp đồng lao động).
- Bảo vệ quyền lợi hợp pháp của Bên B nếu Bên B tuân thủ NDA.

---

## PHẦN 5: SỞ HỮU TRÍ TUỆ (INTELLECTUAL PROPERTY)

### 5.1. Quyền sở hữu tài sản trí tuệ
- Mọi sản phẩm phần mềm, mã nguồn, tài liệu kỹ thuật do Bên B tạo ra trong thời gian làm việc cho Bên A (trong giờ làm việc, sử dụng thiết bị công ty, hoặc sử dụng thông tin mật của Bên A) đều thuộc **quyền sở hữu độc quyền của Bên A** theo Luật Sở hữu trí tuệ và Nghị định 17/2023/NĐ-CP.

- Bên B không có quyền sở hữu, sử dụng, sao chép, phân phối, bán, cho thuê sản phẩm mà Bên B đã tạo ra trong thời gian làm việc cho Bên A, trừ khi có thỏa thuận bằng văn bản khác.

### 5.2. Tài sản trí tuệ trước khi vào công ty
- Bên B khai báo danh sách dự án cá nhân, mã nguồn cá nhân, tài sản trí tuệ sở hữu trước khi ký hợp đồng lao động với Bên A (đính kèm Phụ lục A).
- Những tài sản này không thuộc phạm vi NDA, trừ khi Bên A đầu tư phát triển thêm (có thỏa thuận bằng văn bản).

### 5.3. Sáng tạo cá nhân ngoài giờ làm việc
- Sáng tạo cá nhân hoàn toàn ngoài giờ làm việc, không sử dụng thiết bị công ty, không sử dụng thông tin mật của Bên A, thuộc quyền sở hữu của Bên B.
- Tuy nhiên, Bên B phải chứng minh được đây là sáng tạo hoàn toàn độc lập (không liên quan đến công việc tại Bên A).

---

## PHẦN 6: THỜI HẠN VÀ CHẤM DỨT THỎA THUẬN

### 6.1. Thời hạn hiệu lực
- Thỏa thuận này có hiệu lực từ ngày ký [NGÀY_HIỆU_LỰC] và có thời hạn **không thời hạn** (perpetual) đối với nghĩa vụ bảo mật thông tin.
- Nghĩa vụ bảo mật vẫn tiếp tục ngay cả khi hợp đồng lao động kết thúc, Bên B nghỉ việc, hoặc bị sa thải.

### 6.2. Chấm dứt thỏa thuận
- Thỏa thuận này chỉ chấm dứt khi Bên A có văn bản bằng tay (signed letter) giải phóng Bên B khỏi nghĩa vụ bảo mật.
- Ngay cả khi thỏa thuận chấm dứt, Bên B vẫn phải:
  - Trả lại toàn bộ tài liệu, thiết bị, dữ liệu của Bên A (điện tử và giấy).
  - Xóa toàn bộ thông tin mật khỏi thiết bị cá nhân (laptop, điện thoại, USB, cloud storage).
  - Xác nhận bằng văn bản đã thực hiện các bước trên (certificate of destruction).

### 6.3. Hậu quả vi phạm
- Vi phạm NDA có thể dẫn đến:
  - Sa thải ngay lập tức (không cần báo trước, không trợ cấp thôi việc).
  - Truy cứu trách nhiệm hình sự theo Điều 231 Bộ luật Hình sự (Tội làm lộ bí mật nhà nước, bí mật cá nhân) hoặc Điều 219 (Tội vi phạm quy định về bảo vệ bí mật thông tin người dùng).
  - Bồi thường thiệt hại thực tế (actual damages) và thiệt hại hưởng lợi (lost profits) cho Bên A.
  - Bồi thường chi phí pháp lý (attorney fees) nếu Bên A phải khởi kiện.

---

## PHẦN 7: CAM KẾT CỦA BÊN B

Tôi, **[HỌ TÊN LẬP TRÌNH VIÊN]**, đã đọc, hiểu và cam kết tuân thủ nghiêm ngặt tất cả các điều khoản trong Thỏa thuận bảo mật thông tin này. Tôi hiểu rõ rằng vi phạm thỏa thuận có thể dẫn đến hậu quả pháp lý nghiêm trọng, bao gồm truy cứu trách nhiệm hình sự và bồi thường thiệt hại.

Tôi xác nhận đã nhận được bản sao Thỏa thuận này và đã có cơ hội tham khảo ý kiến luật sư (nếu cần).

---

## PHẦN 8: CHỮ KÝ CÁC BÊN

### Bên A (Công ty):
- **Người đại diện:** [NGƯỜI_DAI_DIỆN]
- **Chức vụ:** [CHỨC_VỤ]
- **Chữ ký:** _________________________
- **Ngày ký:** [NGÀY_THÁNG_NĂM]

### Bên B (Lập trình viên):
- **Họ và tên:** [HỌ TÊN LẬP TRÌNH VIÊN]
- **Chữ ký:** _________________________
- **Ngày ký:** [NGÀY_THÁNG_NĂM]

---

## PHỤ LỤC A: KHAI BÁO TÀI SẢN TRÍ TUỆ TRƯỚC KHI VÀO CÔNG TY

*(Bên B điền vào phần này trước khi ký hợp đồng lao động)*

Tôi, **[HỌ TÊN LẬP TRÌNH VIÊN]**, khai báo các dự án, mã nguồn, tài sản trí tuệ mà tôi sở hữu trước khi vào làm việc tại [TÊN DOANH NGHIỆP]:

1. **Dự án cá nhân / mã nguồn cá nhân:**
   - Tên dự án: [TÊN DỰ ÁN]
   - Mô tả: [MÔ TẢ]
   - Repository (GitHub/GitLab): [LINK] (nếu có)
   - Trạng thái: [ĐANG PHÁT TRIỂN / ĐÃ HOÀN THÀNH / ĐÃ NGHỈ]

2. **Đóng góp vào dự án mã nguồn mở (open source):**
   - Tên dự án: [TÊN DỰ ÁN]
   - Link: [LINK]
   - Vai trò: [VAI TRÒ]

3. **Tài sản trí tuệ khác:**
   - [MIÊU TẢ]

**Cam kết của Bên B:** Tất cả các tài sản được khai báo trên đều thuộc quyền sở hữu của tôi và không vi phạm bản quyền của bên thứ ba. Tôi cam kết không sử dụng các tài sản này trong công việc tại [TÊN DOANH NGHIỆP] trừ khi có thỏa thuận bằng văn bản.

- **Chữ ký Bên B:** _________________________
- **Ngày khai báo:** [NGÀY_THÁNG_NĂM]

---

## PHỤ LỤC B: CHECKLIST BẢO MẬT CHO LẬP TRÌNH VIÊN

*(Sử dụng khi onboard nhân viên mới)*

### Trước khi bắt đầu làm việc:
- [ ] Đã ký NDA (Thỏa thuận bảo mật thông tin).
- [ ] Đã ký IP Assignment Agreement (Thỏa thuận chuyển giao quyền SHTT).
- [ ] Đã cài đặt màn hình khóa (lock screen) với mật khẩu mạnh.
- [ ] Đã kích hoạt xác thực hai yếu tố (2FA) cho tất cả tài khoản (email, Git, cloud console).
- [ ] Đã cài đặt VPN công ty.
- [ ] Đã tham gia đào tạo bảo mật thông tin (security awareness training).
- [ ] Đã nhận tài khoản Git, Jira, Slack, cloud console từ quản trị viên.

### Trong quá trình làm việc:
- [ ] Không chia sẻ mật khẩu, API keys, SSH keys với người khác.
- [ ] Không push code chứa secrets (API keys, passwords) lên Git.
- [ ] Sử dụng .env.example (không chứa giá trị thực) thay vì .env (chứa secrets).
- [ ] Báo cáo ngay cho quản trị viên nếu phát hiện lỗ hổng bảo mật.
- [ ] Không truy cập dữ liệu của khách hàng khác (vi phạm multi-tenant).
- [ ] Không sao chép dữ liệu công ty ra thiết bị cá nhân.

### Khi nghỉ việc / chấm dứt hợp đồng:
- [ ] Trả lại toàn bộ thiết bị công ty (laptop, điện thoại, USB, thẻ từ).
- [ ] Xóa toàn bộ dữ liệu công ty khỏi thiết bị cá nhân.
- [ ] Thu hồi quyền truy cập (Git, Jira, Slack, cloud console, VPN).
- [ ] Xác nhận bằng văn bản đã thực hiện các bước trên (exit interview).

---

## PHỤ LỤC C: CÁC HÌNH THỨC VI PHẠM VÀ HẬU QUẢ

### Các hành vi bị nghiêm cấm:
1. **Sao chép mã nguồn:** Copy toàn bộ hoặc một phần mã nguồn ra thiết bị cá nhân, gửi qua email cá nhân, upload lên public repository.
2. **Chia sẻ thông tin mật:** Tiết lộ thông tin mật cho đối thủ cạnh tranh, bạn bè, người thân, hoặc đăng lên mạng xã hội.
3. **Sử dụng thông tin mật cho mục đích cá nhân:** Sử dụng danh sách khách hàng để kinh doanh riêng, sử dụng mã nguồn để xây dựng sản phẩm cạnh tranh.
4. **Làm lộ thông tin người dùng:** Tiết lộ thông tin cá nhân, lịch sử giao dịch của khách hàng (vi phạm Luật BV dữ liệu cá nhân 2025).
5. **Tấn công hệ thống:** Truy cập trái phép vào hệ thống, đánh cắp dữ liệu, phá hoại hệ thống (hacker, deface, DDoS).
6. **Mua bán thông tin mật:** Bán, trao đổi thông tin mật cho bên thứ ba để hưởng lợi.

### Hậu quả pháp lý:
- **Hành chính:** Phạt tiền theo Nghị định 13/2023/NĐ-CP (vi phạm bảo vệ dữ liệu cá nhân) hoặc Nghị định 15/2020/NĐ-CP (vi phạm an toàn thông tin mạng).
- **Hình sự:** Truy cứu trách nhiệm hình sự theo Bộ luật Hình sự (Điều 219, Điều 231, Điều 289).
- **Dân sự:** Bồi thường thiệt hại thực tế (actual damages) và thiệt hại hưởng lợi (lost profits).
- **Công ty:** Sa thải ngay lập tức, không trợ cấp thôi việc, yêu cầu bồi thường thiệt hại.

---

## PHỤ LỤC D: CÁC VĂN BẢN PHÁP LUẬT LIÊN QUAN

1. **Luật Sở hữu trí tuệ số 50/2005/QH11** (đã sửa đổi, bổ sung) — bảo hộ chương trình máy tính (phần mềm/mã nguồn) dưới hình thức quyền tác giả.
2. **Nghị định số 17/2023/NĐ-CP** (Cập nhật Dự thảo sửa đổi năm 2026) — hướng dẫn thi hành Luật Sở hữu trí tuệ về quyền tác giả.
3. **Thông tư số 08/2026/TT-BVHTTDL** — quy định hệ thống biểu mẫu, tờ khai phục vụ nộp hồ sơ xin cấp Giấy chứng nhận bản quyền phần mềm.
4. **Luật Bảo vệ dữ liệu cá nhân 2025** (Luật số 91/2025/QH15) — quy định về bảo vệ dữ liệu cá nhân, trách nhiệm của tổ chức xử lý dữ liệu.
5. **Nghị định số 356/2025/NĐ-CP** — hướng dẫn thi hành Luật BV dữ liệu cá nhân, quy định biện pháp bảo mật kỹ thuật.
6. **Luật An toàn thông tin mạng số 86/2015/QH13** và **Luật An ninh mạng số 24/2018/QH14** — quy định về bảo vệ thông tin mạng, chống tấn công mạng.
7. **Bộ luật Lao động số 45/2019/QH14** — quy định về quyền sở hữu tài sản trí tuệ của người lao động, nghĩa vụ bảo mật thông tin.
8. **Bộ luật Dân sự số 91/2015/QH13** — quy định về bồi thường thiệt hại, hợp đồng, nghĩa vụ bảo vệ tài sản.

---

## LƯU Ý QUAN TRỌNG

1. **Thỏa thuận này có giá trị pháp lý đầy đủ** theo quy định pháp luật Việt Nam.
2. **Bên B nên tham khảo ý kiến luật sư** trước khi ký nếu có thắc mắc về các điều khoản.
3. **Mọi thay đổi điều khoản phải được thực hiện bằng văn bản** và có chữ ký của cả hai bên.
4. **Bản sao có chữ ký hợp lệ hóa** có giá trị pháp lý tương đương bản gốc.
5. **Giải thích điều khoản:** Nếu có tranh chấp về ý nghĩa của điều khoản, sẽ được giải thích theo nghĩa phù hợp với pháp luật Việt Nam và lợi ích của Bên A (bên sở hữu thông tin mật).

---

*Thỏa thuận này được lập thành 2 bản, mỗi bên giữ 1 bản có giá trị pháp lý như nhau.*

**Bên A:** [TÊN DOANH NGHIỆP]  
**Người đại diện:** [NGƯỜI_DAI_DIỆN]  
**Chữ ký:** _________________________  
**Ngày ký:** [NGÀY_THÁNG_NĂM]

**Bên B:** [HỌ TÊN LẬP TRÌNH VIÊN]  
**Chữ ký:** _________________________  
**Ngày ký:** [NGÀY_THÁNG_NĂM]